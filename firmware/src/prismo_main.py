from machine import WDT
from src import wifi_manager
from src import reader
from src import reader_ui
from src import config
from src import health_log
from src import state
from src.mqtt_client import PrismoMQTT
from src import color

ui = reader_ui.ReaderUI()
mqtt = PrismoMQTT()

def on_new_config_callback():
    health_log.write_info("New config saved")
    ui.show_configuration_save()

def on_key_read(uid):
    allowed = config.is_user_allowed(uid)
    if allowed:
        if config.DEVICE_MODE == config.DEVICE_MODE_MACHINE:
            ui.machine_toggle(uid)
        else:
            ui.success()
    else:
        ui.error()

    health_log.write_info("Key scanned", uid=uid, allowed=allowed)
    machine_active = ui.machine_active if config.DEVICE_MODE == config.DEVICE_MODE_MACHINE else None
    mqtt.publish_scan(uid, allowed, machine_active=machine_active)

def on_add_key(uid):
    health_log.write_info('add_key command received', uid=uid)
    if not uid:
        health_log.write_warn("add_key command missing uid")
        return
    try:
        config.add_uid(uid)
        health_log.write_info("Key added via MQTT", uid=uid)
    except ValueError as e:
        health_log.write_warn("add_key failed", error=str(e))

def on_remove_key(uid):
    health_log.write_info('remove_key command received', uid=uid)
    if not uid:
        health_log.write_warn("remove_key command missing uid")
        return
    try:
        config.delete_uid(uid)
        health_log.write_info("Key removed via MQTT", uid=uid)
    except ValueError as e:
        health_log.write_warn("remove_key failed", error=str(e))

def on_trigger(action):
    health_log.write_info("Trigger command received", action=action)
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

wifi_manager = wifi_manager.WiFiManager()
wifi_ok = wifi_manager.connect(
    on_attempt=color.wifi_connecting_pulse,
    on_complete=color.turn_off_all,
)

mqtt_ok = False
mqtt_cfg = config.get_mqtt_config() if config.ENABLE_MQTT else None
if wifi_ok and mqtt_cfg:
    host, port, user, passwd, use_ssl = mqtt_cfg
    for attempt in range(config.MQTT_CONNECT_ATTEMPTS):
        color.mqtt_connecting_pulse()
        try:
            mqtt.connect(host, port, user, passwd, use_ssl)
            mqtt.subscribe_commands(on_add_key, on_remove_key, on_trigger, on_sync_keys)
            mqtt_ok = True
            break
        except Exception as e:
            health_log.write_warn("MQTT connect attempt failed", attempt=attempt + 1, error=str(e))
    color.turn_off_all()

# Safe mode: the connection is established (or not) here at boot. Once running,
# the device never reconnects on its own — a drop just flips the flag and the
# idle light to offline until the next reboot.
state.set_connected(mqtt_ok)

health_log.write_info("Start reader", connected=mqtt_ok)
ui.reset()
ui.ready_to_read()

wdt = WDT(timeout=10000)
def on_tick():
    wdt.feed()
    if config.ENABLE_MQTT:
        mqtt.maintain()

reader.subscribe(callback=on_key_read, tick_callback=on_tick)
