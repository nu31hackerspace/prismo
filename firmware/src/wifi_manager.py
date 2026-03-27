import network
import time
import gc
from src import config
from src import health_log
import _thread

class WiFiManager:
    def __init__(self):
        health_log.write_info("init wifi manager")

    def connect(self):
        from src import wifi_config
        
        if not wifi_config.has_wifi():
            health_log.write_error("No WiFi configured")
            return

        gc.collect()
        wlan_sta = network.WLAN(network.STA_IF)
        wlan_sta.active(True)
        wlan_sta.config(txpower=8.5)
        
        ssid, password = wifi_config.get_wifi()
        
        health_log.write_info("Connecting to WiFi", ssid=ssid)
        wlan_sta.connect(ssid, password)

        # Wait for connection
        max_wait = 10
        while max_wait > 0:
            if wlan_sta.isconnected():
                break
            max_wait -= 1
            time.sleep(1)

        if wlan_sta.isconnected():
            ip = wlan_sta.ifconfig()[0]
            health_log.write_info("WiFi connected", ip=ip, ssid=ssid)
        else:
            health_log.write_error("WiFi connect failed, starting AP", ssid=ssid)

