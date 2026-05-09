"""
Trigger script — runs on ESP32-C3 via mpremote after test_gpio_real.py has
written config.json with the test UID. Calls on_key_read to exercise the
success GPIO signal. Config must already exist on the device flash.
"""

import sys
import src.config as config

config.DEBUG = False
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

prismo_main.on_key_read("test_card_uid")
