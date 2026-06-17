# Baked-in credentials — replaced by worker before build
WIFI_SSID = "{{WIFI_SSID}}"
WIFI_PASS = "{{WIFI_PASS}}"
MQTT_URL  = "{{MQTT_URL}}"
MQTT_USER = "{{MQTT_USER}}"
MQTT_PASS = "{{MQTT_PASS}}"
DEVICE_MODE = "{{DEVICE_MODE}}"

# Source commit the firmware was built from — replaced by the worker before
# build. For local dev set GIT_COMMIT in config_dev.py.
GIT_COMMIT = "{{GIT_COMMIT}}"

DEVICE_MODE_DOOR = "door"
DEVICE_MODE_MACHINE = "machine"

DEBUG=False
QUICK_START=False
MUTE_BUZZER=False

# Local dev overrides (gitignored)
try:
    from src.config_dev import *
except ImportError:
    pass

def get_wifi():
    if WIFI_SSID and not WIFI_SSID.startswith("{{"):
        return WIFI_SSID, WIFI_PASS
    return None, None

def has_wifi():
    ssid, _ = get_wifi()
    return ssid is not None

def get_git_commit():
    if GIT_COMMIT and not GIT_COMMIT.startswith("{{"):
        return GIT_COMMIT
    return "dev"

def get_mqtt_config():
    """Returns (host, port, user, password, ssl) or None if not configured."""
    if not MQTT_URL or MQTT_URL.startswith("{{"):
        return None
    scheme, rest = MQTT_URL.split('://', 1)
    ssl = scheme in ('mqtts', 'ssl')

    host_port = rest.split(':', 1)
    host = host_port[0]
    port = int(host_port[1]) if len(host_port) > 1 else (8883 if ssl else 1883)
    return host, port, MQTT_USER, MQTT_PASS, ssl


RUN_TIME_CONFIG_FILE = "config.json"

import machine
import ubinascii
from src import health_log

def get_mac_suffix():
    return ubinascii.hexlify(machine.unique_id()).decode().upper()

SUCCESS_SIGNAL_DURATION = 5000
ERROR_SIGNAL_DURATION = 1000

PWM_FREQ = 1000
NFC_BAUDRATE = 1_000_000

PIN_RGB_RED = 9
PIN_RGB_GREEN = 10
PIN_RGB_BLUE = 20

PIN_NFC_SCK = 1
PIN_NFC_MISO = 2
PIN_NFC_MOSI = 3
PIN_NFC_SS = 4

PIN_OUTPUT_SUCESS = 5
PIN_OUTPUT_ERROR = 6

PIN_BUZZER = 7

import json

def is_user_allowed(uid):
    cfg = load_config() or {}
    users = cfg.get('allowed_users', [])
    for user in users:
        if user.get('uid') == uid:
            return True
    return False

def add_uid(uid):
    health_log.write_info('add_uid ', uid=uid)
    cfg = load_config() or {}
    users = cfg.get('allowed_users', [])
    for user in users:
        if user.get('uid') == uid:
            raise ValueError(f"User with UID {uid} already exists")
    users.append({'uid': uid})
    cfg['allowed_users'] = users
    with open(RUN_TIME_CONFIG_FILE, 'w') as f:
        json.dump(cfg, f)

def delete_uid(uid):
    health_log.write_info('delete_uid ', uid=uid)
    cfg = load_config() or {}
    users = cfg.get('allowed_users', [])
    new_users = [u for u in users if u.get('uid') != uid]
    if len(new_users) == len(users):
        raise ValueError(f"User with UID {uid} not found")
    cfg['allowed_users'] = new_users
    with open(RUN_TIME_CONFIG_FILE, 'w') as f:
        json.dump(cfg, f)


def set_uids(keys):
    """Replace the entire allowed_users list.
    keys — list of dicts with at least a 'uid' field, e.g. [{'uid': 'abc', 'username': 'Alice'}]
    """
    health_log.write_info('set_uids', count=len(keys))
    cfg = load_config() or {}
    cfg['allowed_users'] = [{'uid': k['uid'], 'username': k.get('username', '')} for k in keys if k.get('uid')]
    with open(RUN_TIME_CONFIG_FILE, 'w') as f:
        json.dump(cfg, f)

def load_config():
    try:
        with open(RUN_TIME_CONFIG_FILE, 'r') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None

if DEBUG:
    health_log.write_info("Config: debug mode", config=str(load_config()))
