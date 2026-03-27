import os
import time
import threading
import json
import logging
import subprocess

import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ['DATABASE_URL']
WIFI_CONFIG_PATH = '/firmware/src/wifi_config.py'
FIRMWARE_OUTPUT = '/opt/micropython/ports/esp32/build-ESP32_GENERIC_C3/firmware.bin'
POLL_INTERVAL = 5   # seconds between polls when queue is empty
HEARTBEAT_INTERVAL = 10  # seconds between updated_at bumps
BUILD_TIMEOUT = 600  # 10 minutes max per build

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

# Read template once at startup so we can restore it after each build
with open(WIFI_CONFIG_PATH) as f:
    WIFI_CONFIG_TEMPLATE = f.read()


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def pick_job(conn):
    """Atomically claim one pending job. Returns dict or None."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            UPDATE worker_jobs
               SET status        = 'processing',
                   attempt_count = attempt_count + 1,
                   updated_at    = NOW()
             WHERE id = (
                   SELECT id FROM worker_jobs
                    WHERE status        = 'pending'
                      AND attempt_count < max_attempt_count
                    ORDER BY created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
             )
         RETURNING *
        """)
        conn.commit()
        row = cur.fetchone()
        return dict(row) if row else None


def heartbeat_loop(job_id: int, stop: threading.Event):
    """Background thread: keeps updated_at fresh while a job is in progress."""
    conn = get_conn()
    while not stop.wait(HEARTBEAT_INTERVAL):
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE worker_jobs SET updated_at = NOW() WHERE id = %s",
                    (job_id,)
                )
                conn.commit()
        except Exception as e:
            log.warning("Heartbeat failed for job %s: %s", job_id, e)
    conn.close()


def build_firmware(ssid: str, password: str) -> bytes:
    config = WIFI_CONFIG_TEMPLATE \
        .replace('{{WIFI_SSID}}', ssid) \
        .replace('{{WIFI_PASS}}', password)

    with open(WIFI_CONFIG_PATH, 'w') as f:
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
        with open(WIFI_CONFIG_PATH, 'w') as f:
            f.write(WIFI_CONFIG_TEMPLATE)


def store_file(conn, content: bytes, owner_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO files (content, content_type, owner_id) VALUES (%s, %s, %s) RETURNING id",
            (psycopg2.Binary(content), 'application/octet-stream', owner_id),
        )
        file_id = cur.fetchone()[0]
        conn.commit()
        return file_id


def complete_job(conn, job_id: int, output: dict):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE worker_jobs SET status = 'completed', output_payload = %s, updated_at = NOW() WHERE id = %s",
            (json.dumps(output), job_id),
        )
        conn.commit()


def fail_job(conn, job_id: int, attempt_count: int, max_attempt_count: int, error_msg: str):
    # Reset to pending if retries remain, otherwise mark failed
    new_status = 'failed' if attempt_count >= max_attempt_count else 'pending'
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE worker_jobs SET status = %s, output_payload = %s, updated_at = NOW() WHERE id = %s",
            (new_status, json.dumps({'error': error_msg}), job_id),
        )
        conn.commit()


def process_job(job: dict):
    log.info("Processing job %s (attempt %s/%s)", job['id'], job['attempt_count'], job['max_attempt_count'])

    stop = threading.Event()
    hb = threading.Thread(target=heartbeat_loop, args=(job['id'], stop), daemon=True)
    hb.start()

    conn = get_conn()
    try:
        payload = job['input_payload']
        ssid = payload['ssid']
        password = payload['password']

        firmware = build_firmware(ssid, password)

        file_id = store_file(conn, firmware, job['owner_id'])
        complete_job(conn, job['id'], {'fileId': file_id})
        log.info("Job %s completed → file %s", job['id'], file_id)
    except Exception as e:
        log.error("Job %s failed: %s", job['id'], e)
        fail_job(conn, job['id'], job['attempt_count'], job['max_attempt_count'], str(e))
    finally:
        stop.set()
        hb.join(timeout=HEARTBEAT_INTERVAL + 2)
        conn.close()


def main():
    log.info("Worker started, polling every %ss", POLL_INTERVAL)
    while True:
        try:
            log.info("Try to find new job")
            conn = get_conn()
            job = pick_job(conn)
            conn.close()

            if job:
                process_job(job)
            else:
                time.sleep(POLL_INTERVAL)
        except Exception as e:
            log.error("Worker loop error: %s", e)
            time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    main()
