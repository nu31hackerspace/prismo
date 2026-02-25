DEBUG=False
QUICK_START=True

AP_SSID = "00_prismo"
HOSTNAME = "prismo"
RUN_TIME_CONFIG_FILE = "config.json"

SUCCESS_SIGNAL_DURATION = 5000 
ERROR_SIGNAL_DURATION = 1000 

PWM_FREQ = 1000
NFC_BAUDRATE = 1000000

PIN_RGB_RED = 10
PIN_RGB_GREEN = 20
PIN_RGB_BLUE = 21

PIN_NFC_SCK = 4
PIN_NFC_MISO = 5
PIN_NFC_MOSI = 6
PIN_NFC_SS = 7

PIN_OUTPUT_ERROR = 1
PIN_OUTPUT_SUCESS = 2

PIN_BUZZER = 0

import json

def save_config(ssid, password, hostname, admin_password):
    config = {'ssid': ssid, 'password': password, 'hostname': hostname, 'admin_password': admin_password}
    with open(RUN_TIME_CONFIG_FILE, 'w') as f:
        json.dump(config, f)


def load_config():
    try:
        with open(RUN_TIME_CONFIG_FILE, 'r') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None

def get_hostname():
    cfg = load_config()
    if cfg and cfg.get('hostname'):
        return cfg['hostname']
    return HOSTNAME

def get_admin_password():
    cfg = load_config()
    if cfg:
        return cfg.get('admin_password', '')
    return ''

if DEBUG:
    print('[CONFIG] Debug mode')
    print('Print configuration')
    print(load_config())
