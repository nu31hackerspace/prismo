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

    def render_template(self, filename, **kwargs):
        def stream():
            try:
                import src.frozen_assets as frozen_assets
                import io
                content = frozen_assets.FILES.get(f"templates/{filename}")
                if content:
                    f = io.StringIO(content)
                    for line in f:
                        for key, val in kwargs.items():
                            if '{' + key + '}' in line:
                                line = line.replace('{' + key + '}', str(val))
                        yield line
                else:
                    yield "Template not found: " + filename
            except ImportError:
                yield "Template not found: " + filename
        return stream()

    def setup_routes(self):
        @self.app.route('/static/<path:path>')
        def static_file(request, path):
            if '..' in path:
                return 'Not found', 404
            def send_file():
                try:
                    import src.frozen_assets as frozen_assets
                    content = frozen_assets.FILES.get(f"static/{path}")
                    if content:
                        yield content.encode('utf-8')
                except ImportError:
                    pass
            hdr = {'Content-Type': 'text/css'} if path.endswith('.css') else {}
            return send_file(), 200, hdr

        @self.app.route('/', methods=['GET'])
        def index(request):
            saved_password = config.get_admin_password()
            if saved_password:
                return self.login_page(), 200, {'Content-Type': 'text/html'}
            else:
                return self.config_page(), 200, {'Content-Type': 'text/html'}

        @self.app.route('/login', methods=['POST'])
        def login(request):
            params = self.parse_form(request)
            admin_password = params.get('admin_password', '')
            saved_password = config.get_admin_password()

            if admin_password == saved_password:
                return self.config_page(), 200, {'Content-Type': 'text/html'}
            else:
                return self.login_page(error="Wrong password"), 200, {'Content-Type': 'text/html'}

        @self.app.route('/configuration', methods=['POST'])
        def configure(request):
            print("Received configuration")
            try:
                params = self.parse_form(request)

                # Auth check: if device has a saved password, verify it
                saved_password = config.get_admin_password()
                if saved_password:
                    admin_password = params.get('admin_password', '')
                    if admin_password != saved_password:
                        return self.login_page(error="Wrong password"), 200, {'Content-Type': 'text/html'}

                ssid = params.get('ssid')
                password = params.get('password')
                hostname = params.get('hostname', '').strip().lower()
                new_admin_password = params.get('new_admin_password', '').strip()

                # Validate hostname: only lowercase a-z
                if hostname and not all(c.isalpha() and c.islower() for c in hostname):
                    hostname = config.get_hostname()

                if not hostname:
                    hostname = config.get_hostname()

                if not new_admin_password:
                    new_admin_password = saved_password or ''

                if ssid:
                    config.save_config(ssid, password, hostname, new_admin_password)
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
            # Auth check for reset
            saved_password = config.get_admin_password()
            if saved_password:
                params = self.parse_form(request)
                admin_password = params.get('admin_password', '')
                if admin_password != saved_password:
                    return self.login_page(error="Wrong password"), 200, {'Content-Type': 'text/html'}

            print("Factory reset requested")
            try:
                os.remove(config.RUN_TIME_CONFIG_FILE)
                print("Config deleted")
            except Exception as e:
                print("Error deleting config (maybe didn't exist):", e)

            print("Rebooting in 1 second...")
            Timer(0).init(period=1000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
            return '', 302, {'Location': '/'}

    def login_page(self, error=""):
        err = f'<p class="error">{error}</p>' if error else ''
        return self.render_template('login.html', error_html=err)

    def config_page(self, admin_password=""):
        cfg = config.load_config() or {}
        ssid = cfg.get('ssid', '')
        password = cfg.get('password', '')
        hostname = config.get_hostname()
        saved_pwd = config.get_admin_password()
        is_first = not saved_pwd

        if not admin_password and saved_pwd:
            admin_password = saved_pwd

        pwd_lbl = "Device Password" if is_first else "New Password (empty to keep)"
        req = "required" if is_first else ""

        return self.render_template(
            'config.html',
            last_key_html=self._last_key_html(),
            hostname=hostname,
            ssid=ssid,
            password=password,
            admin_password_label=pwd_lbl,
            admin_password_required=req,
            admin_password=admin_password
        )

    def redirect_page(self, hostname):
        return self.render_template('redirect.html', hostname=hostname)

    def _last_key_html(self):
        k = config.get_last_key()
        if k:
            return f'<p><b>Last Key:</b> <code style="font-size:1.2em;background:#f0f0f0;padding:4px 8px;border-radius:4px">{k}</code></p><input type="text" id="username" placeholder="User name" style="width:60%"><button type="button">Add User</button>'
        return '<p style="color:#999">No key scanned yet.</p>'

    def parse_form(self, request):
        params = {}
        if request.headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            body = request.body.decode()
            for pair in body.split('&'):
                if '=' in pair:
                    key, val = pair.split('=', 1)
                    params[self.unquote(key)] = self.unquote(val)
        return params

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