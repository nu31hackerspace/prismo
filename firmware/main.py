import wifi_manager
import reader
import reader_ui
import web_server

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
    ui.success()

print('Start reader...')
reader.subscribe(on_key_read)
