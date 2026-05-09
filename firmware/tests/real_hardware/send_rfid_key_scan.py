"""
Runs on ESP32-C3 via mpremote exec. Calls on_key_read with the given UID to
exercise the success GPIO signal. Config must already exist on the device flash
(written by test_gpio_real.py beforehand).

Invoked by pi_gpio_monitor.py as:
  mpremote exec "key_uid='<uid>'; exec(open('tests/real_hardware/send_rfid_key_scan.py').read())"
"""

import sys
import src.config as config

config.DEBUG = False
config.MUTE_BUZZER = True
config.WIFI_SSID = "{{WIFI_SSID}}"
config.WIFI_PASS = "{{WIFI_PASS}}"
config.MQTT_URL  = "{{MQTT_URL}}"
config.DEVICE_MODE = "door"


class _MockReader:
    @staticmethod
    def subscribe(cb, mqtt_manager=None):
        pass


sys.modules['src.reader'] = _MockReader

import src.prismo_main as prismo_main

prismo_main.on_key_read(key_uid)
