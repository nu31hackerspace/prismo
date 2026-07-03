"""
End-to-End User Flow Test
1. Mocks src.reader to completely skip NFC hardware loops.
2. Prevents WiFi/MQTT connections so the test is fast and self-contained.
3. Invokes the application callback directly with a UID.
4. Verifies the success/error pins toggle correctly.
"""

import sys
import os
import utime
import unittest

import src.config as config

config.DEBUG = True
config.QUICK_START = True
config.MUTE_BUZZER = True

# Clear credentials so WiFi and MQTT are skipped during prismo_main import.
# wifi_manager.connect() checks config.has_wifi() and returns early when these
# are placeholders. config.get_mqtt_config() also returns None for placeholders.
config.WIFI_SSID = "{{WIFI_SSID}}"
config.WIFI_PASS = "{{WIFI_PASS}}"
config.MQTT_URL  = "{{MQTT_URL}}"

# mpremote mount makes the working directory /remote (read-only host mount).
# Point config writes to the device's own writable flash instead.
config.RUN_TIME_CONFIG_FILE = "/runtime_config.json"


class MockReader:
    callback = None

    @staticmethod
    def subscribe(callback, tick_callback):
        print("MockReader: subscribe() called. Capturing callback function.")
        MockReader.callback = callback


class MockReaderModule:
    subscribe = MockReader.subscribe


sys.modules['src.reader'] = MockReaderModule


# prismo_main arms a hardware watchdog (machine.WDT) at import time and only
# feeds it from the reader's tick_callback. Since MockReader never drives that
# callback, the real watchdog would reset the device ~10s into the test run and
# break the mpremote session. Swap in a no-op WDT before prismo_main imports it.
import machine


class MockWDT:
    def __init__(self, timeout=0):
        pass

    def feed(self):
        pass


machine.WDT = MockWDT


class TestE2EScan(unittest.TestCase):
    def setUp(self):
        print("\n >>> Setting up test environment...")
        try:
            os.remove(config.RUN_TIME_CONFIG_FILE)
        except Exception:
            pass

        # The allowlist is cached in RAM and survives across tests in this
        # process; drop it so each test reloads from the freshly cleared file.
        config._allowed_uids = None

        self.pin_events = []

        class MockPin:
            IN = 1
            OUT = 3

            def __init__(inner_self, pin_id, mode=-1):
                inner_self.pin_id = pin_id
                inner_self._value = 0

            def on(inner_self):
                inner_self._value = 1
                self.pin_events.append({"pin": inner_self.pin_id, "state": 1, "time": utime.ticks_ms()})

            def off(inner_self):
                inner_self._value = 0
                self.pin_events.append({"pin": inner_self.pin_id, "state": 0, "time": utime.ticks_ms()})

            def value(inner_self):
                return inner_self._value

        import src.reader_ui
        self.original_pin = src.reader_ui.Pin
        src.reader_ui.Pin = MockPin

        print(">>> Booting full app flow...")
        import src.prismo_main

        # prismo_main skips MQTT configuration with placeholder creds, so wire
        # up the command callbacks manually for the test.
        src.prismo_main.mqtt._user = "test_user"
        src.prismo_main.mqtt.set_command_callbacks(
            src.prismo_main.on_add_key,
            src.prismo_main.on_remove_key,
            src.prismo_main.on_trigger,
            src.prismo_main.on_sync_keys,
        )

        self.assertIsNotNone(MockReader.callback, "FAIL: subscribe() was never called by the application!")
        self.pin_events.clear()

    def tearDown(self):
        import src.reader_ui
        src.reader_ui.Pin = self.original_pin

    def assertOutputPin(self, expect_success_pin: bool):
        success_events = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_SUCESS]

        if expect_success_pin:
            self.assertTrue(len(success_events) >= 2, "Success pin was not toggled ON and OFF")
            self.assertEqual(success_events[0]["state"], 1, "Expected success pin to turn ON first")
            self.assertEqual(success_events[-1]["state"], 0, "Expected success pin to turn OFF last")
            duration = utime.ticks_diff(success_events[-1]["time"], success_events[0]["time"])
            print(f"Success pin was high for {duration}ms (Expected: {config.SUCCESS_SIGNAL_DURATION}ms)")
            self.assertTrue(duration >= config.SUCCESS_SIGNAL_DURATION,
                            f"Success pin toggled too fast! High for {duration}ms, expected at least {config.SUCCESS_SIGNAL_DURATION}ms")
        else:
            self.assertEqual(len(success_events), 0, "Success pin state changed incorrectly!")

        self.pin_events.clear()

    def _send_mqtt_cmd(self, cmd, payload):
        import src.prismo_main
        topic = "prismo/test_user/cmd/{}".format(cmd)
        src.prismo_main.mqtt._on_message(topic, payload)

    def test_valid_scan(self):
        print(">>> Simulating MQTT 'add_key' commands...")
        self._send_mqtt_cmd("add_key", '{"uid": "111111"}')
        self._send_mqtt_cmd("add_key", '{"uid": "222222"}')

        print("\n>>> Simulating reader callback with valid UID: '111111'")
        MockReader.callback("111111")

        self.assertOutputPin(expect_success_pin=True)

    def test_invalid_scan(self):
        print("\n>>> Simulating reader callback with INVALID UID: '222222' (not in allowlist)")
        MockReader.callback("222222")

        self.assertOutputPin(expect_success_pin=False)

    def test_the_key_change(self):
        print("\n>>> Simulating key remove after first scan")
        self._send_mqtt_cmd("add_key", '{"uid": "111111"}')

        MockReader.callback("111111")
        self.assertOutputPin(expect_success_pin=True)

        self._send_mqtt_cmd("remove_key", '{"uid": "111111"}')

        MockReader.callback("111111")
        self.assertOutputPin(expect_success_pin=False)

    def test_trigger_success(self):
        print("\n>>> Simulating MQTT trigger command with action='success'")
        self._send_mqtt_cmd("trigger", '{"action": "success"}')
        self.assertOutputPin(expect_success_pin=True)

    def test_trigger_error(self):
        print("\n>>> Simulating MQTT trigger command with action='error'")
        self._send_mqtt_cmd("trigger", '{"action": "error"}')
        self.assertOutputPin(expect_success_pin=False)

    def test_trigger_machine_on_off(self):
        import src.prismo_main
        ui = src.prismo_main.ui

        print("\n>>> Simulating MQTT trigger command with action='on'")
        self._send_mqtt_cmd("trigger", '{"action": "on"}')

        success_on_events = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_SUCESS and e["state"] == 1]
        self.assertTrue(len(success_on_events) >= 1, "Success pin was not turned ON by 'on' trigger")
        self.assertTrue(ui.machine_active, "machine_active should be True after 'on' trigger")

        self.pin_events.clear()

        print(">>> Simulating MQTT trigger command with action='off'")
        self._send_mqtt_cmd("trigger", '{"action": "off"}')

        success_off_events = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_SUCESS and e["state"] == 0]
        self.assertTrue(len(success_off_events) >= 1, "Success pin was not turned OFF by 'off' trigger")
        self.assertFalse(ui.machine_active, "machine_active should be False after 'off' trigger")

    def test_machine_mode_toggle(self):
        import src.prismo_main
        ui = src.prismo_main.ui
        config.DEVICE_MODE = config.DEVICE_MODE_MACHINE

        self._send_mqtt_cmd("add_key", '{"uid": "AABBCC"}')

        print("\n>>> Machine mode: first scan should latch success pin ON")
        MockReader.callback("AABBCC")

        success_on = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_SUCESS and e["state"] == 1]
        self.assertTrue(len(success_on) >= 1, "Success pin was not turned ON on first scan")
        self.assertTrue(ui.machine_active, "machine_active should be True after first scan")
        self.pin_events.clear()

        print(">>> Machine mode: second scan with same UID should turn success pin OFF")
        MockReader.callback("AABBCC")

        success_off = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_SUCESS and e["state"] == 0]
        self.assertTrue(len(success_off) >= 1, "Success pin was not turned OFF on second scan")
        self.assertFalse(ui.machine_active, "machine_active should be False after second scan")
        self.pin_events.clear()

if __name__ == '__main__':
    unittest.main()
