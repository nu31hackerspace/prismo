"""
Device-side card-scan simulation — runs on ESP32-C3 via mpremote.
Registers a test UID then calls on_key_read() exactly as the PN532 reader
driver would after detecting and hashing a card.
The Raspberry Pi monitors GPIO 17 independently.
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

prismo_main.mqtt._on_message("prismo/test_user/cmd/add_key", '{"uid": "test_card_uid"}')
