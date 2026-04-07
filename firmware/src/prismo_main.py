from src import wifi_manager
from src import reader
from src import reader_ui
from src import config
from src import health_log
from src import mqtt_client
from src import color

ui = reader_ui.ReaderUI()

def on_new_config_callback():
    health_log.write_info("New config saved")
    ui.show_configuration_save()

def on_key_read(uid):
    allowed = config.is_user_allowed(uid)
    health_log.write_info("Key scanned", uid=uid, allowed=allowed)
    config.save_last_key(uid)
    if allowed:
        ui.success()
    else:
        ui.error()
    mqtt_client.publish_scan(uid, allowed)

def on_add_key(name, uid):
    if not uid:
        health_log.write_warn("add_key command missing uid")
        return
    try:
        config.add_user_to_white_list(name, uid)
        health_log.write_info("Key added via MQTT", name=name, uid=uid)
    except ValueError as e:
        health_log.write_warn("add_key failed", error=str(e))

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
    health_log.set_mqtt_publisher(mqtt_client.publish_log)
    mqtt_client.subscribe_commands(on_add_key, on_trigger)
    color.mqtt_connecting_pulse()
    try:
        mqtt_client.connect(host, port, user, passwd, use_ssl)
    except Exception as e:
        health_log.write_warn("Initial MQTT connect failed, will retry", error=str(e))
    color.turn_off_all()

health_log.write_info("Start reader")
ui.ready_to_read()
reader.subscribe(on_key_read)
