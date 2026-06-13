"""
health_log.py – Device health snapshot logger.

Logs are written in JSON Lines format (one JSON object per line),
compatible with Caddy / Loki / any log shipper.

Usage:
    from src import health_log

    # Write one snapshot to the log file (call this periodically):
    health_log.write_log()

    # Collect a raw snapshot dict (without writing to disk):
    snapshot = health_log.collect()

Log file: health.log (in the root of the device filesystem)
Rotation: when the file exceeds MAX_LOG_BYTES, it is renamed to
          health.log.1 and a fresh health.log is started.
          Only one backup file is kept to limit flash usage.
"""

import gc
import os
import machine
import network
import utime
import ubinascii
import json

# ------------------------------------------------------------------ #
# Configuration                                                        #
# ------------------------------------------------------------------ #

LOG_FILE      = "health.log"
BACKUP_FILE   = "health.log.1"
MAX_LOG_BYTES = 32 * 1024   # 32 KB per file; two files = 64 KB max

LOG_VERSION   = "1"

# ------------------------------------------------------------------ #
# Reset cause labels (ESP32 / MicroPython)                            #
#   2 = WDT is the most important: it means the device was frozen     #
# ------------------------------------------------------------------ #
_RESET_LABELS = {
    1: "PWRON",
    2: "WDT",
    3: "SOFT",
    4: "DEEPSLEEP",
    5: "HARD",
}

# Uptime reference – captured at module import (== boot time)
_boot_ticks_ms = utime.ticks_ms()

# GC run counter – incremented by gc_collect() below
_gc_runs = 0


# ------------------------------------------------------------------ #
# Internal helpers                                                     #
# ------------------------------------------------------------------ #

def gc_collect():
    """Call gc.collect() and track how many times it has run."""
    global _gc_runs
    gc.collect()
    _gc_runs += 1


def _file_size(path):
    try:
        return os.stat(path)[6]
    except OSError:
        return 0


def _rotate():
    """Rotate log file if it has grown past MAX_LOG_BYTES."""
    if _file_size(LOG_FILE) < MAX_LOG_BYTES:
        return
    try:
        os.remove(BACKUP_FILE)
    except OSError:
        pass
    try:
        os.rename(LOG_FILE, BACKUP_FILE)
    except OSError:
        # rename may not be available on all ports; fall back to delete
        try:
            os.remove(LOG_FILE)
        except OSError:
            pass


def _get_wifi_info():
    info = {
        "wifi_mode": "NONE",
        "wifi_connected": False,
        "wifi_rssi_dbm": None,
        "wifi_ip": None,
    }
    try:
        sta = network.WLAN(network.STA_IF)
        if sta.active() and sta.isconnected():
            info["wifi_mode"] = "STA"
            info["wifi_connected"] = True
            info["wifi_ip"] = sta.ifconfig()[0]
            try:
                info["wifi_rssi_dbm"] = sta.status("rssi")
            except Exception:
                pass
            return info
        ap = network.WLAN(network.AP_IF)
        if ap.active():
            info["wifi_mode"] = "AP"
            info["wifi_ip"] = ap.ifconfig()[0]
    except Exception:
        pass
    return info


def _get_fs_info():
    info = {"fs_total_kb": None, "fs_free_kb": None}
    try:
        st = os.statvfs("/")
        bsize = st[0]
        info["fs_total_kb"] = (bsize * st[2]) // 1024
        info["fs_free_kb"]  = (bsize * st[3]) // 1024
    except Exception:
        pass
    return info


def _get_firmware_label():
    try:
        return os.uname().version
    except Exception:
        return "unknown"


def get_git_commit():
    """Source commit the firmware was built from.

    The worker substitutes config.GIT_COMMIT at build time; locally it can be
    set in config_dev.py. Falls back to "dev" when left as the template.
    Imported lazily to avoid a circular import (config imports health_log).
    """
    try:
        from src import config
        return config.get_git_commit()
    except Exception:
        return "unknown"


# ------------------------------------------------------------------ #
# Optional MQTT log forwarder                                          #
# Set via set_mqtt_publisher() after MQTT connects to avoid circular  #
# import (mqtt_client already imports health_log).                    #
# ------------------------------------------------------------------ #

_mqtt_publisher = None


def set_mqtt_publisher(fn):
    """Register a callable(entry_dict) that forwards log entries to MQTT."""
    global _mqtt_publisher
    _mqtt_publisher = fn


# ------------------------------------------------------------------ #
# Public API                                                           #
# ------------------------------------------------------------------ #

def collect():
    """
    Gather a device health snapshot.
    Returns a dict – serialise with json.dumps() when needed.
    Calls gc.collect() first so heap numbers are accurate.
    """
    gc_collect()

    reset_cause = machine.reset_cause()
    heap_free   = gc.mem_free()
    heap_alloc  = gc.mem_alloc()
    uptime_ms   = utime.ticks_diff(utime.ticks_ms(), _boot_ticks_ms)
    device_id   = ubinascii.hexlify(machine.unique_id()).decode().upper()[-6:]

    nfc_ok = None
    try:
        from src import reader as _reader
        nfc_ok = _reader.reader_ok
    except Exception:
        pass

    snapshot = {
        "log_version":       LOG_VERSION,
        "device_id":         device_id,
        "firmware":          _get_firmware_label(),
        "git_commit":        get_git_commit(),
        "uptime_s":          uptime_ms // 1000,
        "timestamp_ms":      uptime_ms,
        "reset_cause":       reset_cause,
        "reset_cause_label": _RESET_LABELS.get(reset_cause, "UNKNOWN_{}".format(reset_cause)),
        "heap_free_bytes":   heap_free,
        "heap_alloc_bytes":  heap_alloc,
        "heap_total_bytes":  heap_free + heap_alloc,
        "cpu_freq_mhz":      machine.freq() // 1_000_000,
        "nfc_reader_ok":     nfc_ok,
        "gc_runs":           _gc_runs,
    }
    snapshot.update(_get_wifi_info())
    snapshot.update(_get_fs_info())
    return snapshot


def write_log():
    """
    Collect a health snapshot and append it as a single JSON line
    to health.log. Rotates the file when it exceeds MAX_LOG_BYTES.

    Call this from a machine.Timer callback or a background thread.
    """
    try:
        _rotate()
        line = json.dumps(collect()) + "\n"
        with open(LOG_FILE, "a") as f:
            f.write(line)
    except Exception as e:
        # Never let logging crash the device
        print("[health_log] write error:", e)


def write_event(level, msg, **kwargs):
    """
    Write a one-off structured event to health.log AND print to serial.

    level : "INFO" | "WARN" | "ERROR"
    msg   : short human-readable description
    kwargs: any extra key=value pairs to include in the JSON

    Examples:
        health_log.write_event("INFO",  "WiFi connected", ip="192.168.1.5")
        health_log.write_event("WARN",  "PN532 retry", attempt=3)
        health_log.write_event("ERROR", "WiFi connect failed", ssid=ssid)
    """
    uptime_ms = utime.ticks_diff(utime.ticks_ms(), _boot_ticks_ms)
    device_id = ubinascii.hexlify(machine.unique_id()).decode().upper()[-6:]

    entry = {
        "log_version": LOG_VERSION,
        "type":        "event",
        "level":       level,
        "msg":         msg,
        "device_id":   device_id,
        "uptime_s":    uptime_ms // 1000,
        "timestamp_ms": uptime_ms,
    }
    entry.update(kwargs)

    # Always echo to serial so a connected developer can see it live
    print("[{}] {}".format(level, msg), kwargs if kwargs else "")

    try:
        _rotate()
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        print("[health_log] write_event error:", e)

    if _mqtt_publisher is not None:
        try:
            _mqtt_publisher(entry)
        except Exception:
            pass


# Convenience shorthands
def write_info(msg, **kw):  write_event("INFO",  msg, **kw)
def write_warn(msg, **kw):  write_event("WARN",  msg, **kw)
def write_error(msg, **kw): write_event("ERROR", msg, **kw)
