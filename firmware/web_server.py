from microdot import Microdot
import config
import machine
from machine import Timer

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
                    input {{ padding: 10px; margin: 10px; width: 80%; }}
                    button {{ padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; }}
                </style>
            </head>
            <body>
                <h1>Prismo configuration</h1>
                <form action="/configuration" method="post">
                    <input type="text" name="ssid" placeholder="WiFi SSID" value="{ssid}" required><br>
                    <input type="password" name="password" placeholder="Password" value="{password}" required><br>
                    <button type="submit">Apply</button>
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
                    
                    if ssid:
                        config.save_config(ssid, password)
                        print('ssid ', ssid, 'pass ', password)

                        if self.on_new_config_callback:
                            self.on_new_config_callback()
                        
                        print("Rebooting in 2 seconds...")
                        Timer(0).init(period=2000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
                        
                        return '', 302, {'Location': '/'}

            except Exception as e:
                print("Error parsing config:", e)
            
            return '', 302, {'Location': '/'}

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