from src import wifi_manager
from src import reader
from src import reader_ui
from src import web_server
from src import config

ui = reader_ui.ReaderUI()

def on_ap_start_callback():
    print('AP mode start')
    ui.ap_mode()

def on_new_config_callback():
    print('New config saved callback')
    ui.show_configuration_save()

web_server = web_server.WebServer(on_new_config_callback)
wifi_manager = wifi_manager.WiFiManager(web_server=web_server, on_ap_start_callback=on_ap_start_callback)
wifi_manager.connect()
ui.ready_to_read()


def on_key_read(uid):
    print("New UID:", uid)
    config.save_last_key(uid)
    if config.is_user_allowed(uid):
        ui.success()
    else:
        ui.error()

print('Start reader...')
reader.subscribe(on_key_read)
