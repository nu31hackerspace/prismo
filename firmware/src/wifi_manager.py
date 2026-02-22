import network
import time
from src import config
from src.mdns_server import MDNSServer
from src.dns_server import DNSServer
from src.web_server import WebServer
import _thread

class WiFiManager:
    def __init__(self, web_server, on_ap_start_callback=None):
        self.wlan_sta = network.WLAN(network.STA_IF)
        self.wlan_ap = network.WLAN(network.AP_IF)
        self.dns_server = None
        self.mdns_server = None
        self.web_server = web_server
        self.on_ap_start_callback = on_ap_start_callback

    def start_ap_mode(self):
        print("Starting AP Mode...")
        if self.on_ap_start_callback:
            self.on_ap_start_callback()

        self.wlan_sta.active(False)
        self.wlan_ap.active(True)
        self.wlan_ap.config(txpower=8.5, essid=config.AP_SSID, password="")
        
        try:
            self.wlan_ap.config(hostname=config.HOSTNAME)
        except ValueError as e:
            print('[WIFI] hostname did not setup, because of', e)
            pass
        
        # Configure IP for AP if needed, default is usually 192.168.4.1
        ip = self.wlan_ap.ifconfig()[0]
        print("AP Started. IP:", ip)
        
        # Start DNS Server
        self.dns_server = DNSServer(ip)
        _thread.start_new_thread(self.dns_server.run, ())

        self.start_mdns_server(ip)
        self.start_web_server()

    def start_mdns_server(self, ip):
        self.mdns_server = MDNSServer(ip)
        _thread.start_new_thread(self.mdns_server.run, ())

    def start_web_server(self):
        # Start web server in a new thread so it doesn't block main loop
        _thread.start_new_thread(self.web_server.run, (80,))

    def connect(self):
        run_time_config = config.load_config()
        if not run_time_config:
            print("No config found. Starting AP.")
            self.start_ap_mode()
            return

        self.wlan_ap.active(False)
        self.wlan_sta.active(True)
        self.wlan_sta.config(txpower=8.5)
        
        try:
             self.wlan_sta.config(hostname=config.HOSTNAME)
        except ValueError:
             pass

        ssid = run_time_config.get('ssid')
        password = run_time_config.get('password')
        
        print(f"Connecting to {ssid}...")
        self.wlan_sta.connect(ssid, password)

        # Wait for connection
        max_wait = 10
        while max_wait > 0:
            if self.wlan_sta.isconnected():
                break
            max_wait -= 1
            time.sleep(1)

        if self.wlan_sta.isconnected():
            ip = self.wlan_sta.ifconfig()[0]
            print("Connected! IP:", ip)
            self.start_mdns_server(ip)
            self.start_web_server()
        else:
            print("Failed to connect. Starting AP.")
            self.start_ap_mode()
