import network
import gc
from src import config
from src import health_log
import utime

class WiFiManager:
    def __init__(self):
        health_log.write_info("init wifi manager")

    def connect(self, on_attempt=None, on_complete=None):
        """Try to bring up WiFi. Returns True if connected, False otherwise."""
        if not config.has_wifi():
            # Surface the raw baked value so we can tell apart an empty
            # substitution ("") from an un-substituted template
            # ("{{WIFI_SSID}}") when the device reports no WiFi.
            health_log.write_error("No WiFi configured", raw_ssid=repr(config.WIFI_SSID))
            return False

        gc.collect()
        wlan_sta = network.WLAN(network.STA_IF)
        wlan_sta.active(True)
        wlan_sta.config(txpower=8.5)

        ssid, password = config.get_wifi()

        health_log.write_info("Connecting to WiFi", ssid=ssid)
        wlan_sta.connect(ssid, password)

        attempts = config.WIFI_CONNECT_ATTEMPTS
        while attempts > 0 and not wlan_sta.isconnected():
            health_log.write_info("Try connecting to WiFi", keep_try=attempts)

            attempts -= 1
            utime.sleep_ms(1000)
            if on_attempt:
                on_attempt()

        if on_complete:
            on_complete()

        if wlan_sta.isconnected():
            health_log.write_info("WiFi connected", ip=wlan_sta.ifconfig()[0], ssid=ssid)
            return True

        health_log.write_error("WiFi connect failed", ssid=ssid)
        return False

