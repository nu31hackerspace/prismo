from libs.microdot import Microdot
from src import config
import machine
from machine import Timer
import os

class WebServer:
    def __init__(self, on_new_config_callback=None):
        self.app = Microdot()
        self.setup_routes()
        self.on_new_config_callback = on_new_config_callback

    def setup_routes(self):
        @self.app.route('/', methods=['GET'])
        def index(request):
            current_config = config.load_config()
            ssid = ""
            password = ""
            hostname = config.get_hostname()
            
            if current_config:
                ssid = current_config.get('ssid', '')
                password = current_config.get('password', '')

            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prismo configuration</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {{ font-family: sans-serif; text-align: center; padding: 20px; }}
                    input, select {{ padding: 10px; margin: 10px; width: 80%; }}
                    button {{ padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; }}
                    .danger {{ background-color: #dc3545; }}
                    .hint {{ font-size: 0.85em; color: #666; margin-top: -5px; }}
                </style>
            </head>
            <body>
                <h1>Prismo configuration</h1>
                <form action="/configuration" method="post">
                    <label for="hostname">Device Name</label><br>
                    <input type="text" id="hostname" name="hostname" placeholder="Device Name" value="{hostname}" pattern="[a-z]+" minlength="1" title="Only lowercase English letters (a-z)" required><br>
                    <p class="hint">Your device will be available at <b>{hostname}.local</b></p>
                    
                    <input type="text" name="ssid" placeholder="WiFi SSID" value="{ssid}" required><br>
                    <input type="password" name="password" placeholder="Password" value="{password}" required><br>
                    <button type="submit">Apply</button>
                </form>
                
                <hr style="margin-top: 30px; margin-bottom: 30px;">
                
                <h2>Danger Zone</h2>
                <form action="/reset" method="post" onsubmit="return confirm('Are you sure you want to factory reset? This will delete all settings and reboot.');">
                    <button type="submit" class="danger">Factory Reset</button>
                </form>
            </body>
            </html>
            """
            return html, 200, {'Content-Type': 'text/html'}

        @self.app.route('/configuration', methods=['POST'])
        def configure(request):
            print("Received configuration")
            try:
                if request.headers.get('Content-Type') == 'application/x-www-form-urlencoded':
                    body = request.body.decode()
                    params = {}
                    for pair in body.split('&'):
                        if '=' in pair:
                            key, val = pair.split('=', 1)
                            params[self.unquote(key)] = self.unquote(val)
                    
                    ssid = params.get('ssid')
                    password = params.get('password')
                    hostname = params.get('hostname', '').strip().lower()
                    
                    # Validate hostname: only lowercase a-z
                    if hostname and not all(c.isalpha() and c.islower() for c in hostname):
                        hostname = config.get_hostname()
                    
                    if not hostname:
                        hostname = config.get_hostname()
                    
                    if ssid:
                        config.save_config(ssid, password, hostname)
                        print('ssid', ssid, 'pass', password, 'hostname', hostname)

                        if self.on_new_config_callback:
                            self.on_new_config_callback()
                        
                        print("Rebooting in 2 seconds...")
                        Timer(0).init(period=2000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
                        
                        return self.redirect_page(hostname), 200, {'Content-Type': 'text/html'}

            except Exception as e:
                print("Error parsing config:", e)
            
            return '', 302, {'Location': '/'}

        @self.app.route('/reset', methods=['POST'])
        def reset(request):
            print("Factory reset requested")
            try:
                os.remove(config.RUN_TIME_CONFIG_FILE)
                print("Config deleted")
            except Exception as e:
                print("Error deleting config (maybe didn't exist):", e)
            
            print("Rebooting in 1 second...")
            Timer(0).init(period=1000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
            return '', 302, {'Location': '/'}

    def redirect_page(self, hostname):
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Configuration Saved</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{ font-family: sans-serif; text-align: center; padding: 40px 20px; }}
                .countdown {{ font-size: 2em; font-weight: bold; color: #007bff; margin: 20px 0; }}
                .status {{ color: #666; margin: 10px 0; }}
                a {{ color: #007bff; }}
            </style>
        </head>
        <body>
            <h1>Configuration Saved!</h1>
            <p>Your device is restarting and connecting to WiFi...</p>
            <p class="status">Redirecting to <b>{hostname}.local</b> in</p>
            <p class="countdown" id="timer">15</p>
            <p class="status">seconds</p>
            <p><a href="http://{hostname}.local" id="link">Go to {hostname}.local now</a></p>
            <script>
                var seconds = 15;
                var timer = document.getElementById('timer');
                var interval = setInterval(function() {{
                    seconds--;
                    timer.textContent = seconds;
                    if (seconds <= 0) {{
                        clearInterval(interval);
                        window.location.href = 'http://{hostname}.local';
                    }}
                }}, 1000);
            </script>
        </body>
        </html>
        """

    def unquote(self, string):
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

    def run(self, port=80):
        print(f"Starting Web Server on port {port}...")
        self.app.run(port=port)