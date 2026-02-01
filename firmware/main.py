import wifi_manager
import color
import reader
import buzzer

# wm = wifi_manager.WiFiManager()

# wm.start_ap_mode()

last_uid = None
def on_key_read(uid):
    global last_uid
    
    print("New UID:", uid)
    if uid == last_uid:
        return
    
    color.main_diode_show_success()
    buzzer.play_success_sound()
    
    last_uid = uid

print('Start reader...')
reader.subscribe(on_key_read)
