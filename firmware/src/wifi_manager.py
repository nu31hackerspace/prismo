import network
import gc
from src import config
from src import health_log

class WiFiManager:
    def __init__(self):
        health_log.write_info("init wifi manager")

    def connect(self, on_attempt=None, on_complete=None):
        if not config.has_wifi():
            health_log.write_error("No WiFi configured")
            return

        gc.collect()
        wlan_sta = network.WLAN(network.STA_IF)
        wlan_sta.active(True)
        wlan_sta.config(txpower=8.5)

        ssid, password = config.get_wifi()

        health_log.write_info("Connecting to WiFi", ssid=ssid, password=password)
        wlan_sta.connect(ssid, password)

        max_wait = 15
        while max_wait > 0:
            health_log.write_warn("Try to connect attempt")
            if wlan_sta.isconnected():
                break
            max_wait -= 1
            if on_attempt:
                on_attempt()

        if on_complete:
            on_complete()

        if wlan_sta.isconnected():
            ip = wlan_sta.ifconfig()[0]
            health_log.write_info("WiFi connected", ip=ip, ssid=ssid)
        else:
            health_log.write_error("WiFi connect failed", ssid=ssid)

