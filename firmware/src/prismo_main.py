import _thread
import time
import utime
from machine import WDT
from src import wifi_manager
from src import reader
from src import reader_ui
from src import config
from src import health_log
from src import mqtt_worker
from src.mqtt_client import PrismoMQTT
from src import color

ui = reader_ui.ReaderUI()
mqtt = PrismoMQTT()
scan_queue = mqtt_worker.ScanQueue()

# Serialises UI access: on_key_read runs on the reader thread while remote
# on_trigger commands run on the MQTT worker thread, and both drive the same
# LED/buzzer/output pin and machine_active state. Guard the call sites (not
# ReaderUI, whose methods call each other — a non-reentrant lock would deadlock).
ui_lock = _thread.allocate_lock()

wifi_manager = wifi_manager.WiFiManager()
wifi_ok = wifi_manager.connect(
    on_attempt=color.wifi_connecting_pulse,
    on_complete=color.turn_off_all,
)

def on_new_config_callback():
    health_log.write_info("New config saved")
    with ui_lock:
        ui.show_configuration_save()

def on_key_read(uid):
    allowed = config.is_user_allowed(uid)
    with ui_lock:
        if allowed:
            if config.DEVICE_MODE == config.DEVICE_MODE_MACHINE:
                ui.machine_toggle(uid)
            else:
                ui.success()
        else:
            ui.error()
        machine_active = ui.machine_active if config.DEVICE_MODE == config.DEVICE_MODE_MACHINE else None

    health_log.write_info("Key scanned", uid=uid, allowed=allowed)
    # Hand off to the MQTT worker thread; never touch the socket from here so a
    # slow reconnect can't stall the next card scan.
    scan_queue.put(uid, allowed, machine_active)

def on_trigger(action):
    health_log.write_info("Trigger command received", action=action)
    with ui_lock:
        if action == "success":
            ui.success()
        elif action == "error":
            ui.error()
        elif action == "on":
            ui.machine_on()
        elif action == "off":
            ui.machine_off()
        else:
            health_log.write_warn("Unknown trigger action", action=action)

def on_sync_keys(keys):
    """Replace the local allowlist with the server-authoritative key list."""
    health_log.write_info("sync_keys command received", count=len(keys))
    try:
        config.set_uids(keys)
        health_log.write_info("Keys synced from server", count=len(keys))
    except Exception as e:
        health_log.write_warn("sync_keys failed", error=str(e))

mqtt_ok = False
mqtt_cfg = config.get_mqtt_config() if config.ENABLE_MQTT else None
if mqtt_cfg:
    # Configure unconditionally: even if WiFi is down at boot, maintain() can
    # establish the first connection once the network appears.
    mqtt.configure(*mqtt_cfg)
    mqtt.set_command_callbacks(on_trigger, on_sync_keys)
if wifi_ok and mqtt_cfg:
    for attempt in range(config.MQTT_CONNECT_ATTEMPTS):
        color.mqtt_connecting_pulse()
        try:
            mqtt.connect_now()
            mqtt_ok = True
            break
        except Exception as e:
            health_log.write_warn("MQTT connect attempt failed", attempt=attempt + 1, error=str(e))
    color.turn_off_all()

# Boot ends here with the connection up or not; either way the tick-driven
# maintenance below keeps retrying WiFi and MQTT forever with capped backoff.
# state.is_connected is owned by the MQTT layer from now on.

health_log.write_info("Start reader", connected=mqtt_ok)
ui.reset()
ui.ready_to_read()

# 20s watchdog, fed every loop iteration below. The main thread no longer does
# network I/O — WiFi/MQTT maintenance runs on the worker thread and never gates
# a feed. The only thing that now delays a feed is the UI lock: a card scan can
# wait out an in-flight remote-trigger hold (≤ SUCCESS/ERROR signal duration)
# before taking its own hold. Two stacked holds stay well under 20s.
wdt = WDT(timeout=20000)

# Sole owner of the MQTT socket: runs WiFi/MQTT reconnection and drains the
# scan queue off the main thread. Extra stack for the TLS handshake.
_thread.stack_size(16 * 1024)
_thread.start_new_thread(
    mqtt_worker.run,
    (mqtt, wifi_manager, scan_queue, config.ENABLE_MQTT),
)

# Main app loop: owns the NFC poll and the watchdog feed. If PN532 init fails
# permanently, reader.init() returns None and this script simply ends here —
# the watchdog, armed above and never fed again, resets the board so boot
# retries the hardware init from scratch.
nfc = reader.init()
if nfc is not None:
    health_log.write_info("Waiting for RFID/NFC card")
    _last_log_ms = utime.ticks_ms()
    while True:
        uid_hash = reader.read_uid(nfc)
        if uid_hash is not None:
            on_key_read(uid_hash)
            time.sleep(1)

        wdt.feed()

        now = utime.ticks_ms()
        if utime.ticks_diff(now, _last_log_ms) >= 60_000:
            health_log.write_log()
            _last_log_ms = now

