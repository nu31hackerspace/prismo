import json

WIFI_FILE = "wifi.json"

def save_wifi(ssid, password):
    try:
        with open(WIFI_FILE, 'w') as f:
            json.dump({'ssid': ssid, 'password': password}, f)
        return True
    except OSError:
        return False

def get_wifi():
    try:
        with open(WIFI_FILE, 'r') as f:
            data = json.load(f)
            return data.get('ssid', ''), data.get('password', '')
    except (OSError, ValueError):
        return '', ''

def has_wifi():
    ssid, _ = get_wifi()
    return bool(ssid)

def clear_wifi():
    try:
        import os
        os.remove(WIFI_FILE)
    except OSError:
        pass
