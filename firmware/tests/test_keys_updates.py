"""
End-to-End User Flow Test
1. Mocks allowlist with 3 expected UIDs (User1, User2, User3).
2. Mocks src.reader to completely skip hardware loops.
3. Invokes the application callback directly with a valid hex UID.
4. Verifies the success pin triggers HIGH and error pin stays LOW natively.
"""

import sys
import json
import utime
import unittest
from machine import Pin

import src.config as config

config.DEBUG = True
config.QUICK_START = True   
config.MUTE_BUZZER = True   
config.SUCCESS_SIGNAL_DURATION = 100  # Keep fake test cycles fast

class MockReader:
    callback = None
    @staticmethod
    def subscribe(cb):
        print("MockReader: subscribe() called. Capturing callback function.")
        MockReader.callback = cb

class MockReaderModule:
    subscribe = MockReader.subscribe

sys.modules['src.reader'] = MockReaderModule

class TestE2EScan(unittest.TestCase):
    def setUp(self):
        print("\n >>> Setting up test environment...")
        import os
        try:
            os.remove(config.RUN_TIME_CONFIG_FILE)
        except Exception:
            pass
            
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
        
        self.assertIsNotNone(MockReader.callback, "FAIL: subscribe() was never called by the application!")
        self.pin_events.clear()

    def tearDown(self):
        import src.reader_ui
        src.reader_ui.Pin = self.original_pin

    def assertOutputPin(self, expect_success_pin: bool, expect_error_pin: bool):
        success_events = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_SUCESS]
        error_events = [e for e in self.pin_events if e["pin"] == config.PIN_OUTPUT_ERROR]
        
        if expect_success_pin:
            self.assertTrue(len(success_events) >= 2, "Success pin was not toggled ON and OFF")
            self.assertEqual(success_events[0]["state"], 1, "Expected success pin to turn ON first")
            self.assertEqual(success_events[-1]["state"], 0, "Expected success pin to turn OFF last")
            duration = utime.ticks_diff(success_events[-1]["time"], success_events[0]["time"])
            print(f"Success pin was high for {duration}ms (Expected: {config.SUCCESS_SIGNAL_DURATION}ms)")
            self.assertTrue(duration >= config.SUCCESS_SIGNAL_DURATION, f"Success pin toggled too fast! High for {duration}ms, expected at least {config.SUCCESS_SIGNAL_DURATION}ms")
        else:
            self.assertEqual(len(success_events), 0, "Success pin state changed incorrectly!")

        if expect_error_pin:
            self.assertTrue(len(error_events) >= 2, "Error pin was not toggled ON and OFF")
            self.assertEqual(error_events[0]["state"], 1, "Expected error pin to turn ON first")
            self.assertEqual(error_events[-1]["state"], 0, "Expected error pin to turn OFF last")
            duration = utime.ticks_diff(error_events[-1]["time"], error_events[0]["time"])
            print(f"Error pin was high for {duration}ms (Expected: {config.ERROR_SIGNAL_DURATION}ms)")
            self.assertTrue(duration >= config.ERROR_SIGNAL_DURATION, f"Error pin toggled too fast! High for {duration}ms, expected at least {config.ERROR_SIGNAL_DURATION}ms")
        else:
            self.assertEqual(len(error_events), 0, "Error pin state changed incorrectly!")
         
        # Clear the pin events to make clear state for next accerts 
        self.pin_events.clear()

    def test_valid_scan(self):
        import src.mqtt_client
        print(">>> Simulating MQTT 'add_key' command to add valid UID: '111111'...")
        src.mqtt_client._user = "test_user"
        src.mqtt_client._on_message("prismo/test_user/cmd/add_key", '{"uid": "111111"}')
        src.mqtt_client._on_message("prismo/test_user/cmd/add_key", '{"uid": "222222"}')
        
        print("\n>>> Simulating reader callback with valid UID: '111111'")
        MockReader.callback("111111")
            
        self.assertOutputPin(expect_success_pin=True, expect_error_pin=False)

    def test_invalid_scan(self):
        import src.mqtt_client
        print("\n>>> Simulating reader callback with INVALID UID: 'deadbeef'")
        
        MockReader.callback("222222")
            
        self.assertOutputPin(expect_success_pin=False, expect_error_pin=True)
    
    def test_the_key_change(self):
        import src.mqtt_client
        print("\n>>> Simulating key remove after first scan")
        src.mqtt_client._on_message("prismo/test_user/cmd/add_key", '{"uid": "111111"}')
        
        MockReader.callback("111111")
        self.assertOutputPin(expect_success_pin=True, expect_error_pin=False)
        
        src.mqtt_client._on_message("prismo/test_user/cmd/remove_key", '{"uid": "111111"}')
        
        MockReader.callback("111111")
            
        self.assertOutputPin(expect_success_pin=False, expect_error_pin=True)


if __name__ == '__main__':
    unittest.main()
