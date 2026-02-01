import network
import time
import json
import machine

from microdot import Microdot, send_file

import uasyncio as asyncio
import socket
import struct
import config

class DNSServer:
    def __init__(self, ip):
        self.ip = ip
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(('', 53))
        self.running = True
        
    def handle_request(self, data, addr):
        # Header: ID (2B), Flags (2B), QDCOUNT (2B), ANCOUNT (2B), ...
        # Response: ID, Flags (0x8180), QDCOUNT, ANCOUNT (1), ...
        
        # Simple parsing to get query domain
        # Should actually fully parse answer...
        # But for captive portal we return our IP for everything
        
        # Parse query ID
        tid = data[0:2]
        
        # Flags
        # 0x8180 Standard query response, No error
        flags = b'\x81\x80'
        
        # Counts
        qdcount = data[4:6]
        ancount = b'\x00\x01'
        nscount = b'\x00\x00'
        arcount = b'\x00\x00'
        
        # Query section (Question) - we just copy it back
        # The query name is variable length.
        # It ends with 0x00.
        # Then type (2B) and class (2B).
        
        # Find end of query name
        idx = 12
        while data[idx] != 0:
            idx += data[idx] + 1
        idx += 1 # 0 byte
        idx += 4 # Type and Class
        
        query_section = data[12:idx]
        
        # Answer section
        # Name ptr (pointer to offset 12) => 0xC00C
        name_ptr = b'\xC0\x0C'
        type_a = b'\x00\x01'
        class_in = b'\x00\x01'
        ttl = b'\x00\x00\x00\x3C' # 60s
        dlen = b'\x00\x04' # 4 bytes IP
        
        # Convert IP string to bytes
        ip_parts = map(int, self.ip.split('.'))
        addr_bytes = bytes(ip_parts)
        
        response = tid + flags + qdcount + ancount + nscount + arcount + query_section + name_ptr + type_a + class_in + ttl + dlen + addr_bytes
        
        self.sock.sendto(response, addr)

    def run(self):
        print("DNS Server started")
        while self.running:
            try:
                # Use select or non-blocking?
                # For simplicity in this loop, blocking recv
                data, addr = self.sock.recvfrom(1024)
                if data:
                    self.handle_request(data, addr)
            except Exception as e:
                print("DNS Error:", e)
                # Avoid tight loop on error
                time.sleep(1)

    def stop(self):
        self.running = False
        self.sock.close()


class WiFiManager:
    def __init__(self):
        self.wlan_sta = network.WLAN(network.STA_IF)
        self.wlan_ap = network.WLAN(network.AP_IF)
        self.app = None

    def start_ap_mode(self):
        print("Starting AP Mode...")
        self.wlan_sta.active(False)
        self.wlan_ap.active(True)
        self.wlan_ap.config(txpower=8.5, essid=config.AP_SSID, password="")
        
        # Configure IP for AP if needed, default is usually 192.168.4.1
        ip = self.wlan_ap.ifconfig()[0]
        print("AP Started. IP:", ip)
        
        # Start DNS Server
        self.dns_server = DNSServer(ip)
        # We need to run DNS server in a separate thread or async. 
        # Since Microdot uses asyncio (Wait! does standard Microdot use asyncio?), 
        # Standard microdot using `app.run()` blocks.
        # So we need `_thread` for DNS or use `microdot_asyncio`.
        # Assuming `microdot.py` downloaded is the sync version.
        # We can run DNS in a thread.
        
        import _thread
        _thread.start_new_thread(self.dns_server.run, ())

        self.start_web_server()

    def start_web_server(self):
        self.app = Microdot()

        @self.app.route('/')
        def index(request):
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prismo Setup</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    input { padding: 10px; margin: 10px; width: 80%; }
                    button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>Prismo Setup</h1>
                <form action="/configure" method="post">
                    <input type="text" name="ssid" placeholder="WiFi SSID" required><br>
                    <input type="password" name="password" placeholder="Password" required><br>
                    <button type="submit">Connect</button>
                </form>
            </body>
            </html>
            """
            return html, 200, {'Content-Type': 'text/html'}

        @self.app.route('/configure', methods=['POST'])
        def configure(request):
            print("Received configuration")
            # Microdot form data parsing depends on implementation details, 
            # assuming standard form-urlencoded or json. 
            # With simple form, request.form should work if supported, or parsing body.
            # Simplified parsing:
            try:
                if request.headers.get('Content-Type') == 'application/x-www-form-urlencoded':
                    body = request.body.decode()
                    params = {}
                    for pair in body.split('&'):
                        if '=' in pair:
                            key, val = pair.split('=', 1)
                            params[unquote(key)] = unquote(val)
                    
                    ssid = params.get('ssid')
                    password = params.get('password')
                    
                    if ssid:
                        config.save_config(ssid, password)
                        print('ssid ', ssid, 'pass ', password)
                        
                        from machine import Timer
                        print("Rebooting in 2 seconds...")
                        Timer(0).init(period=2000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
                        
                        return "Saved! Rebooting...", 200

            except Exception as e:
                print("Error parsing config:", e)
            
            return "Error saving config", 400

        print("Starting Web Server on port 80...")
        self.app.run(port=80)

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
            print("Connected! IP:", self.wlan_sta.ifconfig()[0])
            # Here we could start mDNS if supported or use a library
        else:
            print("Failed to connect. Starting AP.")
            self.start_ap_mode()


def unquote(string):
    """Simple URL decoder for MicroPython"""
    if not string:
        return ""
    res = string.split('%')
    if len(res) == 1:
        return string
    
    out = res[0]
    for part in res[1:]:
        try:
            char_hex = part[:2]
            out += chr(int(char_hex, 16))
            out += part[2:]
        except ValueError:
            out += '%' + part
    return out.replace('+', ' ')

# Instantiate and use in main.py
