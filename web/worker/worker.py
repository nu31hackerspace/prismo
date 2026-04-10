import os
import time
import threading
import logging
import subprocess
from datetime import datetime, timezone

import pymongo
import gridfs

MONGODB_URL = os.environ['MONGODB_URL']
MQTT_HOST = os.environ.get('MQTT_HOST', 'localhost')
MQTT_PORT = os.environ.get('MQTT_PORT', '1883')
MQTT_SSL  = os.environ.get('MQTT_SSL', 'false')
CONFIG_PATH = '/firmware/src/config.py'
FIRMWARE_OUTPUT = '/opt/micropython/ports/esp32/build-ESP32_GENERIC_C3/firmware.bin'
POLL_INTERVAL = 5   # seconds between polls when queue is empty
HEARTBEAT_INTERVAL = 10  # seconds between updated_at bumps
BUILD_TIMEOUT = 600  # 10 minutes max per build

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

# Read template once at startup so we can restore it after each build
with open(CONFIG_PATH) as f:
    CONFIG_TEMPLATE = f.read()


def get_db():
    client = pymongo.MongoClient(MONGODB_URL)
    return client['prismo']


def pick_job(db):
    """Atomically claim one pending job. Returns dict or None."""
    return db['worker_jobs'].find_one_and_update(
        {
            'status': 'pending',
            '$expr': {'$lt': ['$attemptCount', '$maxAttemptCount']}
        },
        {
            '$set': {'status': 'processing', 'updatedAt': datetime.now(timezone.utc)},
            '$inc': {'attemptCount': 1}
        },
        sort=[('createdAt', pymongo.ASCENDING)],
        return_document=pymongo.ReturnDocument.AFTER
    )


def heartbeat_loop(job_id, stop: threading.Event):
    """Background thread: keeps updatedAt fresh while a job is in progress."""
    db = get_db()
    while not stop.wait(HEARTBEAT_INTERVAL):
        try:
            db['worker_jobs'].update_one(
                {'_id': job_id},
                {'$set': {'updatedAt': datetime.now(timezone.utc)}}
            )
        except Exception as e:
            log.warning("Heartbeat failed for job %s: %s", job_id, e)


def build_firmware(ssid: str, password: str, mqtt_user: str, mqtt_pass: str) -> bytes:
    config = CONFIG_TEMPLATE \
        .replace('{{WIFI_SSID}}', ssid) \
        .replace('{{WIFI_PASS}}', password) \
        .replace('{{MQTT_HOST}}', MQTT_HOST) \
        .replace('{{MQTT_PORT}}', MQTT_PORT) \
        .replace('{{MQTT_USER}}', mqtt_user) \
        .replace('{{MQTT_PASS}}', mqtt_pass) \
        .replace('{{MQTT_SSL}}', MQTT_SSL)

    with open(CONFIG_PATH, 'w') as f:
        f.write(config)

    try:
        result = subprocess.run(
            ['bash', '/worker/build.sh'],
            capture_output=True,
            text=True,
            timeout=BUILD_TIMEOUT,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Build failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")

        with open(FIRMWARE_OUTPUT, 'rb') as f:
            return f.read()
    finally:
        # Always restore the template so the next job starts clean
        with open(CONFIG_PATH, 'w') as f:
            f.write(CONFIG_TEMPLATE)


def store_file(db, content: bytes, owner_id: str) -> str:
    fs = gridfs.GridFS(db, collection='firmware')
    file_id = fs.put(
        content,
        contentType='application/octet-stream',
        metadata={'ownerId': owner_id, 'contentType': 'application/octet-stream'}
    )
    return str(file_id)


def complete_job(db, job_id, file_id: str):
    db['worker_jobs'].update_one(
        {'_id': job_id},
        {'$set': {
            'status': 'completed',
            'outputPayload': {'fileId': file_id},
            'updatedAt': datetime.now(timezone.utc)
        }}
    )


def fail_job(db, job_id, attempt_count: int, max_attempt_count: int, error_msg: str):
    new_status = 'failed' if attempt_count >= max_attempt_count else 'pending'
    db['worker_jobs'].update_one(
        {'_id': job_id},
        {'$set': {
            'status': new_status,
            'outputPayload': {'error': error_msg},
            'updatedAt': datetime.now(timezone.utc)
        }}
    )


def process_job(job: dict):
    log.info("Processing job %s (attempt %s/%s)", job['_id'], job['attemptCount'], job['maxAttemptCount'])

    stop = threading.Event()
    hb = threading.Thread(target=heartbeat_loop, args=(job['_id'], stop), daemon=True)
    hb.start()

    db = get_db()
    try:
        payload = job['inputPayload']
        ssid = payload['ssid']
        password = payload['password']
        mqtt_user = payload['mqttUser']
        mqtt_pass = payload['mqttPass']
        owner_id = str(job['ownerId'])

        firmware = build_firmware(ssid, password, mqtt_user, mqtt_pass)

        file_id = store_file(db, firmware, owner_id)
        complete_job(db, job['_id'], file_id)
        log.info("Job %s completed → file %s", job['_id'], file_id)
    except Exception as e:
        log.error("Job %s failed: %s", job['_id'], e)
        fail_job(db, job['_id'], job['attemptCount'], job['maxAttemptCount'], str(e))
    finally:
        stop.set()
        hb.join(timeout=HEARTBEAT_INTERVAL + 2)


def main():
    log.info("Worker started, polling every %ss", POLL_INTERVAL)
    while True:
        try:
            log.info("Try to find new job")
            db = get_db()
            job = pick_job(db)

            if job:
                process_job(job)
            else:
                time.sleep(POLL_INTERVAL)
        except Exception as e:
            log.error("Worker loop error: %s", e)
            time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    main()
