# Baked-in credentials — replaced by worker before build
WIFI_SSID = "{{WIFI_SSID}}"
WIFI_PASS = "{{WIFI_PASS}}"
MQTT_HOST = "{{MQTT_HOST}}"
MQTT_PORT = "{{MQTT_PORT}}"
MQTT_USER = "{{MQTT_USER}}"
MQTT_PASS = "{{MQTT_PASS}}"
MQTT_SSL  = "{{MQTT_SSL}}"

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

def get_mqtt_config():
    """Returns (host, port, user, password, ssl) or None if not configured."""
    if MQTT_HOST and not MQTT_HOST.startswith("{{"):
        return MQTT_HOST, int(MQTT_PORT), MQTT_USER, MQTT_PASS, MQTT_SSL == "true"
    return None

DEBUG=False
QUICK_START=False
MUTE_BUZZER=False

RUN_TIME_CONFIG_FILE = "config.json"

import machine
import ubinascii
from src import health_log

def get_mac_suffix():
    return ubinascii.hexlify(machine.unique_id()).decode().upper()

SUCCESS_SIGNAL_DURATION = 5000 
ERROR_SIGNAL_DURATION = 1000 

PWM_FREQ = 1000
NFC_BAUDRATE = 1000000

PIN_RGB_RED = 9
PIN_RGB_GREEN = 10
PIN_RGB_BLUE = 20

PIN_NFC_SCK = 4
PIN_NFC_MISO = 5
PIN_NFC_MOSI = 6
PIN_NFC_SS = 7

PIN_OUTPUT_ERROR = 1
PIN_OUTPUT_SUCESS = 2

PIN_BUZZER = 0

import json

_last_key_id = None

def save_last_key(key):
    global _last_key_id
    _last_key_id = key

def get_last_key():
    return _last_key_id

def is_user_allowed(uid):
    cfg = load_config() or {}
    users = cfg.get('allowed_users', [])
    for user in users:
        if user.get('uid') == uid:
            return True
    return False

def add_user_to_white_list(username, uid):
    cfg = load_config() or {}
    users = cfg.get('allowed_users', [])
    for user in users:
        if user.get('uid') == uid:
            raise ValueError(f"User with UID {uid} already exists")
    users.append({'name': username, 'uid': uid})
    cfg['allowed_users'] = users
    with open(RUN_TIME_CONFIG_FILE, 'w') as f:
        json.dump(cfg, f)

def save_config(hostname):
    cfg = load_config() or {}
    cfg['hostname'] = hostname
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
