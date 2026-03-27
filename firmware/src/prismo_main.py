import _thread
from src import wifi_manager
from src import reader
from src import reader_ui
from src import config
from src import health_log

ui = reader_ui.ReaderUI()

def on_new_config_callback():
    health_log.write_info("New config saved")
    ui.show_configuration_save()

def on_key_read(uid):
    health_log.write_info("Key scanned", uid=uid, allowed=config.is_user_allowed(uid))
    config.save_last_key(uid)
    if config.is_user_allowed(uid):
        ui.success()
    else:
        ui.error()

wifi_manager = wifi_manager.WiFiManager()
wifi_manager.connect()

health_log.write_info("Start reader")
ui.ready_to_read()
reader.subscribe(on_key_read)
