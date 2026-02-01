import wifi_manager
import reader
import reader_ui

wifi_manager = wifi_manager.WiFiManager()

wifi_manager.start_ap_mode()

ui = reader_ui.ReaderUI()

def on_key_read(uid):
    print("New UID:", uid)
    ui.success()

print('Start reader...')
reader.subscribe(on_key_read)
