"""
Hardware GPIO test — runs on the ESP32-C3 via mpremote, no MockPin.
GPIO 1 (error) and GPIO 2 (success) fire real voltage signals.
The pi_gpio_monitor.py script on the Raspberry Pi reads those signals.

Print protocol (one line per event, parsed by pi_gpio_monitor.py):
  GPIO_TEST:<scenario>:START
  GPIO_TEST:<scenario>:EXPECT_SUCCESS | EXPECT_ERROR | EXPECT_MACHINE_ON | EXPECT_MACHINE_OFF
  GPIO_TEST:<scenario>:DONE
  GPIO_TEST:ALL:COMPLETE
"""

import os
import sys

import src.config as config

config.DEBUG = False
config.QUICK_START = True
config.MUTE_BUZZER = True
config.WIFI_SSID = "{{WIFI_SSID}}"
config.WIFI_PASS = "{{WIFI_PASS}}"
config.MQTT_URL  = "{{MQTT_URL}}"


class MockReader:
    callback = None

    @staticmethod
    def subscribe(cb, mqtt_manager=None):
        MockReader.callback = cb


class MockReaderModule:
    subscribe = MockReader.subscribe


sys.modules['src.reader'] = MockReaderModule

import src.prismo_main as prismo_main

prismo_main.mqtt._user = "test_user"
prismo_main.mqtt.subscribe_commands(
    prismo_main.on_add_key,
    prismo_main.on_remove_key,
    prismo_main.on_trigger,
    prismo_main.on_sync_keys,
)


def _marker(scenario, event):
    print("GPIO_TEST:{}:{}".format(scenario, event))


def _cmd(action, payload):
    prismo_main.mqtt._on_message("prismo/test_user/cmd/{}".format(action), payload)


def _reset():
    try:
        os.remove(config.RUN_TIME_CONFIG_FILE)
    except Exception:
        pass
    config.DEVICE_MODE = config.DEVICE_MODE_DOOR
    ui = prismo_main.ui
    ui.machine_active = False
    ui.active_uid = None
    ui.success_pin.off()
    ui.error_pin.off()


# --- valid_scan: known UID should fire success pin ---
_reset()
_marker("valid_scan", "START")
_cmd("add_key", '{"uid": "111111"}')
_marker("valid_scan", "EXPECT_SUCCESS")
MockReader.callback("111111")
_marker("valid_scan", "DONE")

# --- trigger_success: MQTT trigger action=success ---
_reset()
_marker("trigger_success", "START")
_marker("trigger_success", "EXPECT_SUCCESS")
_cmd("trigger", '{"action": "success"}')
_marker("trigger_success", "DONE")

# --- machine_on: MQTT trigger action=on latches success pin HIGH ---
_reset()
_marker("machine_on", "START")
_marker("machine_on", "EXPECT_MACHINE_ON")
_cmd("trigger", '{"action": "on"}')
_marker("machine_on", "DONE")

# --- machine_off: MQTT trigger action=off pulls success pin LOW ---
_marker("machine_off", "START")
_marker("machine_off", "EXPECT_MACHINE_OFF")
_cmd("trigger", '{"action": "off"}')
_marker("machine_off", "DONE")

_marker("ALL", "COMPLETE")
