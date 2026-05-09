"""
Runs on ESP32-C3 via mpremote exec. Registers the given UID as an allowed key
so that a subsequent scan of that UID triggers the success GPIO pull.

Invoked by pi_gpio_monitor.py as:
  mpremote exec "key_uid='<uid>'; exec(open('tests/real_hardware/add_key_for_success_pull.py').read())"
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


class _MockReader:
    @staticmethod
    def subscribe(cb, mqtt_manager=None):
        pass


sys.modules['src.reader'] = _MockReader

import src.prismo_main as prismo_main

try:
    os.remove(config.RUN_TIME_CONFIG_FILE)
except OSError:
    pass

prismo_main.mqtt._user = "test_user"
prismo_main.mqtt.subscribe_commands(
    prismo_main.on_add_key,
    prismo_main.on_remove_key,
    prismo_main.on_trigger,
    prismo_main.on_sync_keys,
)

prismo_main.mqtt._on_message("prismo/test_user/cmd/add_key", f'{{"uid": "{key_uid}"}}')
