import _thread
from src import wifi_manager
from src import reader
from src import reader_ui
from src import web_server
from src import config
from src import health_log

ui = reader_ui.ReaderUI()

def on_ap_start_callback():
    health_log.write_info("AP mode start")
    ui.ap_mode()

def on_new_config_callback():
    health_log.write_info("New config saved")
    ui.show_configuration_save()

web_server = web_server.WebServer(on_new_config_callback)
wifi_manager = wifi_manager.WiFiManager(web_server=web_server, on_ap_start_callback=on_ap_start_callback)
_thread.start_new_thread(wifi_manager.connect, ())
_thread.start_new_thread(wifi_manager.monitor, ())


def on_key_read(uid):
    health_log.write_info("Key scanned", uid=uid, allowed=config.is_user_allowed(uid))
    config.save_last_key(uid)
    if config.is_user_allowed(uid):
        ui.success()
    else:
        ui.error()

health_log.write_info("Start reader")
ui.ready_to_read()
reader.subscribe(on_key_read)
