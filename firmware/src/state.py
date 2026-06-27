"""Shared device connection state.

`is_connected` is True only while the MQTT link (and therefore WiFi) is up. The
reader UI uses it to colour the idle sub-light, and the MQTT layer flips it to
False the instant a connection is lost. In safe mode the device never reconnects
on its own — it stays offline until the next reboot.
"""

from src import health_log

is_connected = False


def set_connected(value, reason=None):
    global is_connected
    if value == is_connected:
        return
    is_connected = value
    if value:
        health_log.write_info("Device online")
    else:
        health_log.write_warn("Device offline", reason=reason)
