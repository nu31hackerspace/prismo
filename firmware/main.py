import wifi_manager

wm = wifi_manager.WiFiManager()

wm.start_ap_mode()

import time
while True:
    time.sleep(1)
