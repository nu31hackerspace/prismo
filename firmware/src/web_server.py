from libs.microdot import Microdot
from src import config
from src import auth
from src import wifi_config
from src import health_log
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

    def check_auth(self, request):
        """Returns True if authenticated or if no password is set."""
        saved_password = auth.get_password()
        if not saved_password:
            return True # Not set up yet
        if request.cookies.get('auth') == '1':
            return True
        return False

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
            if not auth.get_password():
                return '', 302, {'Location': '/setup'}
            if not wifi_config.has_wifi():
                return '', 302, {'Location': '/setup_wifi'}
            
            if not self.check_auth(request):
                return self.login_page(), 200, {'Content-Type': 'text/html'}
                
            return self.main_page(), 200, {'Content-Type': 'text/html'}
            
        @self.app.route('/setup', methods=['GET', 'POST'])
        def setup(request):
            if auth.get_password():
                return '', 302, {'Location': '/'} # Already setup
                
            if request.method == 'POST':
                params = self.parse_form(request)
                admin_pwd = params.get('admin_password', '').strip()
                if admin_pwd:
                    auth.save_password(admin_pwd)
                    # Automatically log them in by setting the cookie, then route to step 2
                    return '', 302, {'Location': '/setup_wifi', 'Set-Cookie': 'auth=1; Path=/'}
                return self.render_template('setup.html', error_html='<p class="error">Password required</p>'), 200, {'Content-Type': 'text/html'}
                
            return self.render_template('setup.html', error_html=''), 200, {'Content-Type': 'text/html'}

        @self.app.route('/setup_wifi', methods=['GET', 'POST'])
        def setup_wifi_route(request):
            if not self.check_auth(request):
                 return '', 302, {'Location': '/login'}
            
            if wifi_config.has_wifi() and request.method == 'GET':
                 return '', 302, {'Location': '/'} # Already set up

            if request.method == 'POST':
                params = self.parse_form(request)
                ssid = params.get('ssid', '').strip()
                pwd = params.get('password', '')
                if ssid:
                    wifi_config.save_wifi(ssid, pwd)
                    if self.on_new_config_callback:
                        self.on_new_config_callback()
                    Timer(0).init(period=2000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
                    return self.redirect_page(config.get_hostname()), 200, {'Content-Type': 'text/html'}
                return self.render_template('setup_wifi.html', error_html='<p class="error">SSID required</p>'), 200, {'Content-Type': 'text/html'}
            
            return self.render_template('setup_wifi.html', error_html=''), 200, {'Content-Type': 'text/html'}

        @self.app.route('/login', methods=['GET', 'POST'])
        def login(request):
            if not auth.get_password():
                return '', 302, {'Location': '/setup'}
                
            if request.method == 'GET':
                 return self.login_page(), 200, {'Content-Type': 'text/html'}
                 
            params = self.parse_form(request)
            admin_password = params.get('admin_password', '')
            saved_password = auth.get_password()

            if admin_password == saved_password:
                if not wifi_config.has_wifi():
                    return '', 302, {'Location': '/setup_wifi', 'Set-Cookie': 'auth=1; Path=/'}
                return '', 302, {'Location': '/', 'Set-Cookie': 'auth=1; Path=/'}
            
            return self.login_page(error="Wrong password"), 200, {'Content-Type': 'text/html'}

        @self.app.route('/settings', methods=['GET'])
        def settings_page_route(request):
            if not self.check_auth(request):
                return '', 302, {'Location': '/login'}
            return self.settings_page(), 200, {'Content-Type': 'text/html'}

        @self.app.route('/configuration', methods=['POST'])
        def configure(request):
            if not self.check_auth(request):
                 return '', 302, {'Location': '/login'}
                 
            try:
                params = self.parse_form(request)

                ssid = params.get('ssid')
                password = params.get('password')
                hostname = params.get('hostname', '').strip().lower()
                new_admin_password = params.get('new_admin_password', '').strip()

                if hostname and not all(c.isalpha() and c.islower() for c in hostname):
                    hostname = config.get_hostname()
                if not hostname:
                    hostname = config.get_hostname()

                if new_admin_password:
                    auth.save_password(new_admin_password)

                if ssid:
                    wifi_config.save_wifi(ssid, password)
                
                config.save_config(hostname)

                if self.on_new_config_callback:
                    self.on_new_config_callback()

                Timer(0).init(period=2000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
                return self.redirect_page(hostname), 200, {'Content-Type': 'text/html'}

            except Exception as e:
                health_log.write_error("Error parsing config", error=str(e))

            return '', 302, {'Location': '/settings'}

        @self.app.route('/reset', methods=['POST'])
        def reset(request):
            if not self.check_auth(request):
                 return '', 302, {'Location': '/login'}

            try:
                os.remove(config.RUN_TIME_CONFIG_FILE)
            except Exception:
                pass
            auth.clear_password()
            wifi_config.clear_wifi()

            Timer(0).init(period=1000, mode=Timer.ONE_SHOT, callback=lambda t: machine.reset())
            # Wipe cookie on reset
            return '', 302, {'Location': '/', 'Set-Cookie': 'auth=; Path=/; Max-Age=0'}

        @self.app.route('/add_user', methods=['POST'])
        def add_user(request):
            if not self.check_auth(request):
                 return '', 302, {'Location': '/login'}
                 
            params = self.parse_form(request)
            username = self.unquote(params.get('username', '')).strip()
            uid = self.unquote(params.get('uid', '')).strip()

            if username and uid:
                try:
                    config.add_user_to_white_list(username, uid)
                    config._last_key_id = None
                except ValueError as e:
                    health_log.write_warn("Error adding user", error=str(e))
            
            return '', 302, {'Location': '/'}

    def login_page(self, error=""):
        err = f'<p class="error">{error}</p>' if error else ''
        return self.render_template('login.html', error_html=err)

    def main_page(self):
        return self.render_template(
            'main.html',
            last_key_html=self._last_key_html(),
            users_list_html=self._users_list_html()
        )

    def settings_page(self):
        ssid, password = wifi_config.get_wifi()
        return self.render_template(
            'settings.html',
            hostname=config.get_hostname(),
            ssid=ssid,
            password=password
        )

    def redirect_page(self, hostname):
        return self.render_template('redirect.html', hostname=hostname)

    def _last_key_html(self):
        k = config.get_last_key()
        if k:
            return f'''
            <h2>New Key Detected</h2>
            <p>UID: <code>{k}</code></p>
            <form action="/add_user" method="post" style="margin-top:15px;">
                <input type="hidden" name="uid" value="{k}">
                <div class="form-group">
                    <input type="text" name="username" placeholder="Enter owner's name" required>
                </div>
                <button type="submit">Add User</button>
            </form>
            '''
        return '<p class="status">No new key scanned. Tap a tag to register it.</p>'

    def _users_list_html(self):
        cfg = config.load_config() or {}
        users = cfg.get('allowed_users', [])
        
        if not users:
            return "<h2>Allowed Users</h2><p class='status'>No users added yet.</p>"
            
        html = "<h2>Allowed Users</h2><div style='margin-top: 15px;'>"
        for user in users:
            name = user.get('name', 'Unknown')
            uid = user.get('uid', '???')
            html += f"<div class='user-item'><b>{name}</b> <code>{uid}</code></div>"
        html += "</div>"
        return html

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
        health_log.write_info("Starting web server", port=port)
        self.app.run(port=port)