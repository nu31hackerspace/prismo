import json
import machine
import ubinascii
from src import health_log

try:
    from src.build_info import GIT_COMMIT
except ImportError:
    GIT_COMMIT = "dev-except"

DEVICE_MODE_DOOR = "door"
DEVICE_MODE_MACHINE = "machine"

DEBUG=False
QUICK_START=False
MUTE_BUZZER=False
# When False the device runs fully offline: no MQTT connect, maintain, or
# command handling. Door scanning stays on the local cached allowlist.
ENABLE_MQTT=True

# Boot connection attempts before the device starts offline. Runtime
# maintenance then keeps retrying WiFi and MQTT forever with capped backoff.
WIFI_CONNECT_ATTEMPTS=10
MQTT_CONNECT_ATTEMPTS=10

# Local dev overrides (gitignored)
try:
    from src.config_dev import *
except ImportError:
    pass

RUN_TIME_CONFIG_FILE = "config.json"

def load_config():
    try:
        with open(RUN_TIME_CONFIG_FILE, 'r') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}

def _save_config(cfg):
    with open(RUN_TIME_CONFIG_FILE, 'w') as f:
        json.dump(cfg, f)

NVS_NAMESPACE = "cfg"

STR = "string"
INT = "int"
BOOL = "bool"
ENUM = "enum"

SETTINGS = (
    {"key": "wifi_ssid", "type": STR, "label": "Wi-Fi SSID", "max_len": 32, "default": "", "reboot": True},
    {"key": "wifi_pass", "type": STR, "label": "Wi-Fi password", "max_len": 63, "default": "", "secret": True, "reboot": True},
    {"key": "mqtt_url", "type": STR, "label": "MQTT URL", "max_len": 128, "default": "", "reboot": True},
    {"key": "mqtt_user", "type": STR, "label": "MQTT user", "max_len": 64, "default": "", "reboot": True},
    {"key": "mqtt_pass", "type": STR, "label": "MQTT password", "max_len": 64, "default": "", "secret": True, "reboot": True},
    {"key": "mode", "type": ENUM, "label": "Device mode", "options": [DEVICE_MODE_DOOR, DEVICE_MODE_MACHINE], "default": DEVICE_MODE_DOOR, "reboot": True},
)

_DEFS = {d["key"]: d for d in SETTINGS}
_values = {}
_nvs = None

for _d in SETTINGS:
    assert len(_d["key"]) <= 15, _d["key"]


def _check_mqtt_url(value):
    if value and not (value.startswith("mqtt://") or value.startswith("mqtts://") or value.startswith("ssl://")):
        return "must start with mqtt:// or mqtts://"
    return None

_EXTRA_CHECKS = {"mqtt_url": _check_mqtt_url}


def validate(d, value):
    t = d["type"]
    if t == STR:
        if not isinstance(value, str):
            return "must be a string"
        if len(value.encode()) > d["max_len"]:
            return "max {} bytes".format(d["max_len"])
    elif t == INT:
        if isinstance(value, bool) or not isinstance(value, int):
            return "must be an integer"
        if value < d["min"]:
            return "min {}".format(d["min"])
        if value > d["max"]:
            return "max {}".format(d["max"])
    elif t == BOOL:
        if not isinstance(value, bool):
            return "must be true or false"
    elif t == ENUM:
        if value not in d["options"]:
            return "must be one of: " + ", ".join(d["options"])
    check = _EXTRA_CHECKS.get(d["key"])
    return check(value) if check else None


def _blob_size(d):
    return d["max_len"] if d["type"] == STR else max(len(o.encode()) for o in d["options"])


def _nvs_read(d):
    key = d["key"]
    if d["type"] in (INT, BOOL):
        v = _nvs.get_i32(key)
        return bool(v) if d["type"] == BOOL else v
    buf = bytearray(_blob_size(d))
    n = _nvs.get_blob(key, buf)
    return bytes(buf[:n]).decode()


def _nvs_write(d, value):
    key = d["key"]
    if d["type"] in (INT, BOOL):
        _nvs.set_i32(key, int(value))
    else:
        _nvs.set_blob(key, value.encode())


def _nvs_erase(key):
    try:
        _nvs.erase_key(key)
    except OSError:
        pass


def _load():
    for d in SETTINGS:
        key = d["key"]
        try:
            value = _nvs_read(d)
        except (OSError, UnicodeError):
            _values[key] = d["default"]
            continue
        err = validate(d, value)
        if err:
            health_log.write_warn("Stored setting invalid, using default", key=key, error=err)
            value = d["default"]
        _values[key] = value


def _migrate_config_json():
    cfg = load_config()
    legacy = [k for k in _DEFS if k in cfg]
    if not legacy:
        return
    for key in legacy:
        d = _DEFS[key]
        value = cfg.pop(key)
        if isinstance(value, str) and value.startswith("{{"):
            continue
        if validate(d, value) is None:
            _nvs_write(d, value)
    _nvs.commit()
    _save_config(cfg)
    health_log.write_info("Settings migrated from config.json to NVS", keys=legacy)


def init():
    global _nvs
    import esp32
    _nvs = esp32.NVS(NVS_NAMESPACE)
    _migrate_config_json()
    _load()


def get(key):
    return _values[key]


def values_for_host():
    out = {}
    for d in SETTINGS:
        value = _values[d["key"]]
        out[d["key"]] = {"set": value != ""} if d.get("secret") else value
    return out


def set_many(values):
    """Validate every field, then apply all or nothing.
    Returns (errors, reboot_required); errors is empty on success."""
    errors = {}
    changes = {}
    for key, value in values.items():
        d = _DEFS.get(key)
        if d is None:
            errors[key] = "unknown setting"
            continue
        if d.get("secret"):
            if value == "":
                continue
            if value is None:
                changes[key] = ""
                continue
        err = validate(d, value)
        if err:
            errors[key] = err
        else:
            changes[key] = value
    if errors:
        return errors, False

    reboot = False
    changed = []
    for key, value in changes.items():
        if _values[key] == value:
            continue
        d = _DEFS[key]
        if value == d["default"]:
            _nvs_erase(key)
        else:
            _nvs_write(d, value)
        changed.append(key)
        reboot = reboot or d.get("reboot", False)
    if changed:
        _nvs.commit()
        for key in changed:
            _values[key] = changes[key]
        health_log.write_info("Settings saved", keys=changed)
    return {}, reboot



init()

def get_wifi():
    ssid = get("wifi_ssid")
    if ssid:
        return ssid, get("wifi_pass")
    return None, None

def has_wifi():
    ssid, _ = get_wifi()
    return ssid is not None

def get_git_commit():
    return GIT_COMMIT

def get_mqtt_config():
    """Returns (host, port, user, password, ssl) or None if not configured."""
    mqtt_url = get("mqtt_url")
    if not mqtt_url:
        return None
    scheme, rest = mqtt_url.split('://', 1)
    ssl = scheme in ('mqtts', 'ssl')

    host_port = rest.split(':', 1)
    host = host_port[0]
    port = int(host_port[1]) if len(host_port) > 1 else (8883 if ssl else 1883)
    return host, port, get("mqtt_user"), get("mqtt_pass"), ssl

DEVICE_MODE = get("mode")

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

PIN_BUZZER = 7

# In-RAM allowlist so the scan path never reads or parses flash. None means
# "not loaded yet"; it is populated lazily on first lookup and kept in sync by
# the add/delete/set mutators below.
_allowed_uids = None

def _ensure_allowlist():
    global _allowed_uids
    if _allowed_uids is None:
        cfg = load_config() or {}
        _allowed_uids = set(u.get('uid') for u in cfg.get('allowed_users', []) if u.get('uid'))
    return _allowed_uids

def is_user_allowed(uid):
    return uid in _ensure_allowlist()


def set_uids(keys):
    """Replace the entire allowed_users list.
    keys — list of dicts with at least a 'uid' field, e.g. [{'uid': 'abc'}]
    """
    global _allowed_uids, _keys_checksum
    health_log.write_info('set_uids', count=len(keys))
    cfg = load_config() or {}
    cfg['allowed_users'] = [{'uid': k['uid']} for k in keys if k.get('uid')]
    _save_config(cfg)
    _allowed_uids = set(u['uid'] for u in cfg['allowed_users'])
    _keys_checksum = None  # stale — recomputed lazily by get_keys_checksum()


# Cached sha256 checksum of the sorted local allowlist uids, reported on every
# status heartbeat so the server can detect drift and republish cmd_sync.
# Invalidated (set back to None) whenever set_uids() replaces the allowlist.
_keys_checksum = None

def _compute_checksum():
    import uhashlib
    import ubinascii
    uids = sorted(_ensure_allowlist())
    h = uhashlib.sha256(",".join(uids).encode())
    return ubinascii.hexlify(h.digest()).decode()

def get_keys_checksum():
    global _keys_checksum
    if _keys_checksum is None:
        _keys_checksum = _compute_checksum()
    return _keys_checksum

if DEBUG:
    health_log.write_info("Config: debug mode", config=str(load_config()))
