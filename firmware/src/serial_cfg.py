"""Line-based configuration protocol over the USB serial console.

Every protocol line, in both directions, is `@cfg <json>\\n`. Anything else on
the wire is ordinary log output and is ignored here. Runs on its own thread so
the device stays configurable while boot is still retrying WiFi/MQTT.

The reader waits briefly before draining input and bails out once stop() is
called, so a host sending Ctrl-C/Ctrl-A (mpremote) reaches the REPL instead of
this thread.
"""

import sys
import json
import select
import machine
import utime
import _thread
from src import config
from src import console
from src import health_log

PROTO = 1
PREFIX = b"@cfg "
MAX_LINE = 1024
_SETTLE_MS = 50
_REBOOT_DELAY_MS = 200

_running = False


def send(msg):
    console.write("@cfg " + json.dumps(msg) + "\n")


def _mac():
    return ":".join("{:02X}".format(b) for b in machine.unique_id())


def _reboot_after_reply():
    utime.sleep_ms(_REBOOT_DELAY_MS)
    machine.reset()


def _dispatch(msg):
    rid = msg.get("id")
    cmd = msg.get("cmd")
    if cmd == "info":
        send({"id": rid, "ok": True, "data": {
            "fw": config.get_git_commit(),
            "model": "esp32c3",
            "mac": _mac(),
            "proto": PROTO,
        }})
    elif cmd == "schema":
        send({"id": rid, "ok": True, "data": config.SETTINGS})
    elif cmd == "get":
        send({"id": rid, "ok": True, "data": config.values_for_host()})
    elif cmd == "set":
        values = msg.get("values")
        if not isinstance(values, dict):
            send({"id": rid, "ok": False, "err": "bad_request"})
            return
        errors, reboot = config.set_many(values)
        if errors:
            send({"id": rid, "ok": False, "err": "validation", "fields": errors})
        else:
            send({"id": rid, "ok": True, "reboot_required": reboot})
    elif cmd == "status":
        send({"id": rid, "ok": True, "data": health_log.collect()})
    elif cmd == "reboot":
        send({"id": rid, "ok": True})
        _reboot_after_reply()
    elif cmd == "factory_reset":
        config.factory_reset()
        send({"id": rid, "ok": True})
        _reboot_after_reply()
    else:
        send({"id": rid, "ok": False, "err": "unknown_cmd"})


def _handle_line(line):
    if line.endswith(b"\r"):
        line = line[:-1]
    if not line.startswith(PREFIX):
        return
    try:
        msg = json.loads(line[len(PREFIX):].decode())
    except (ValueError, UnicodeError):
        send({"ok": False, "err": "bad_json"})
        return
    if not isinstance(msg, dict):
        send({"ok": False, "err": "bad_json"})
        return
    try:
        _dispatch(msg)
    except Exception as e:
        health_log.write_warn("Config command failed", cmd=str(msg.get("cmd")), error=str(e))
        send({"id": msg.get("id"), "ok": False, "err": "internal"})


def _run():
    stdin = sys.stdin.buffer
    poller = select.poll()
    poller.register(sys.stdin, select.POLLIN)
    buf = bytearray()
    too_long = False
    send({"evt": "boot", "proto": PROTO})
    while _running:
        try:
            if not poller.poll(100):
                continue
            utime.sleep_ms(_SETTLE_MS)
            while _running and poller.poll(0):
                c = stdin.read(1)
                if not c:
                    break
                if c == b"\n":
                    if too_long:
                        send({"ok": False, "err": "too_long"})
                    elif buf:
                        _handle_line(bytes(buf))
                    buf = bytearray()
                    too_long = False
                elif too_long:
                    pass
                elif len(buf) >= MAX_LINE:
                    too_long = True
                    buf = bytearray()
                else:
                    buf.extend(c)
        except Exception as e:
            health_log.write_warn("Serial config loop error", error=str(e))
            buf = bytearray()
            too_long = False


def start():
    global _running
    _running = True
    _thread.stack_size(8 * 1024)
    _thread.start_new_thread(_run, ())


def stop():
    global _running
    _running = False
