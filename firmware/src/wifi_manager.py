import network
import time
import gc
from src import config
from src.mdns_server import MDNSServer
from src.dns_server import DNSServer
from src.web_server import WebServer
import _thread

class WiFiManager:
    def __init__(self, web_server, on_ap_start_callback=None):
        self.dns_server = None
        self.mdns_server = None
        self.web_server = web_server
        self.on_ap_start_callback = on_ap_start_callback

    def start_ap_mode(self):
        print("Starting AP Mode...")
        if self.on_ap_start_callback:
            self.on_ap_start_callback()

        hostname = config.get_hostname()

        gc.collect()
        wlan_ap = network.WLAN(network.AP_IF)
        wlan_ap.active(True)
        wlan_ap.config(txpower=8.5, essid=config.AP_SSID, password="")
        
        try:
            wlan_ap.config(hostname=hostname)
        except ValueError as e:
            print('[WIFI] hostname did not setup, because of', e)
            pass
        
        ip = wlan_ap.ifconfig()[0]
        print("AP Started. IP:", ip)
        
        # Start DNS Server
        self.dns_server = DNSServer(ip)
        _thread.start_new_thread(self.dns_server.run, ())

        self.start_mdns_server(ip, hostname)
        self.start_web_server()

    def start_mdns_server(self, ip, hostname):
        self.mdns_server = MDNSServer(ip, hostname)
        _thread.start_new_thread(self.mdns_server.run, ())

    def start_web_server(self):
        # Start web server in a new thread so it doesn't block main loop
        _thread.start_new_thread(self.web_server.run, (80,))

    def connect(self):
        from src import wifi_config
        
        hostname = config.get_hostname()

        if not wifi_config.has_wifi():
            print("No WiFi configured. Starting AP.")
            self.start_ap_mode()
            return

        gc.collect()
        wlan_sta = network.WLAN(network.STA_IF)
        wlan_sta.active(True)
        wlan_sta.config(txpower=8.5)
        
        try:
             wlan_sta.config(hostname=hostname)
        except ValueError:
             pass

        ssid, password = wifi_config.get_wifi()
        
        print(f"Connecting to {ssid}...")
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
            print("Connected! IP:", ip)
            self.start_mdns_server(ip, hostname)
            self.start_web_server()
        else:
            print("Failed to connect. Starting AP.")
            self.start_ap_mode()

