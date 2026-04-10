from src import wifi_manager
from src import reader
from src import reader_ui
from src import config
from src import health_log
from src.mqtt_client import PrismoMQTT
from src import color

ui = reader_ui.ReaderUI()
mqtt = PrismoMQTT()

def on_new_config_callback():
    health_log.write_info("New config saved")
    ui.show_configuration_save()

def on_key_read(uid):
    allowed = config.is_user_allowed(uid)
    health_log.write_info("Key scanned", uid=uid, allowed=allowed)
    if allowed:
        ui.success()
    else:
        ui.error()
    mqtt.publish_scan(uid, allowed)

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
    else:
        health_log.write_warn("Unknown trigger action", action=action)

wifi_manager = wifi_manager.WiFiManager()
wifi_manager.connect(
    on_attempt=color.wifi_connecting_pulse,
    on_complete=color.turn_off_all,
)

mqtt_cfg = config.get_mqtt_config()
if mqtt_cfg:
    host, port, user, passwd, use_ssl = mqtt_cfg
    # Register publisher and handlers before connect so they survive a failed
    # initial attempt and are in place when maintain() reconnects later.
    health_log.set_mqtt_publisher(mqtt.publish_log)
    color.mqtt_connecting_pulse()
    try:
        mqtt.connect(host, port, user, passwd, use_ssl)
        mqtt.subscribe_commands(on_add_key, on_remove_key, on_trigger)
    except Exception as e:
        health_log.write_warn("Initial MQTT connect failed, will retry", error=str(e))
    color.turn_off_all()

health_log.write_info("Start reader")
ui.ready_to_read()
reader.subscribe(on_key_read, mqtt)
