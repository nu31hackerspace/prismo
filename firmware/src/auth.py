import json

AUTH_FILE = "auth.json"

def save_password(password):
    try:
        with open(AUTH_FILE, 'w') as f:
            json.dump({'admin_password': password}, f)
        return True
    except OSError:
        return False

def get_password():
    try:
        with open(AUTH_FILE, 'r') as f:
            data = json.load(f)
            return data.get('admin_password', '')
    except (OSError, ValueError):
        return ''

def clear_password():
    try:
        import os
        os.remove(AUTH_FILE)
    except OSError:
        pass
