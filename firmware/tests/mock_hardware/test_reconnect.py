"""
WiFi/MQTT runtime reconnection tests.
1. Fakes network.WLAN so WiFiManager.maintain() can be driven through loss,
   in-flight attempts, backoff, radio reset and recovery without radio traffic.
2. Fakes the umqtt client class so PrismoMQTT reconnect/first-connect logic
   runs without a broker.
3. Timers are shrunk per instance (the code reads them from self) so a full
   backoff cycle takes milliseconds.
"""

import utime
import unittest

import src.config as config

config.QUICK_START = True
config.MUTE_BUZZER = True

# Real-looking credentials so config.has_wifi() is True; no association ever
# happens because network.WLAN is faked below. Keep boot connect fast.
config.WIFI_SSID = "TestAP"
config.WIFI_PASS = "test-pass"
config.WIFI_CONNECT_ATTEMPTS = 1

import src.wifi_manager as wifi_manager
import src.mqtt_client as mqtt_client
import src.state as state

_TERMINAL_STATUS = 201  # e.g. NO_AP_FOUND — anything not STAT_CONNECTING/None


class FakeWLAN:
    def __init__(self):
        self.connect_calls = []
        self.active_calls = []
        self.connected = False
        self.status_value = None
        self.active_state = True
        self.raise_on_connect = None

    def active(self, value=None):
        if value is None:
            return self.active_state
        self.active_calls.append(value)
        self.active_state = value

    def config(self, **kwargs):
        pass

    def isconnected(self):
        return self.connected

    def status(self):
        return self.status_value

    def connect(self, ssid, password):
        if self.raise_on_connect:
            raise self.raise_on_connect
        self.connect_calls.append((ssid, password))
        self.status_value = wifi_manager._STAT_CONNECTING

    def disconnect(self):
        self.status_value = None

    def ifconfig(self):
        return ("192.0.2.10", "255.255.255.0", "192.0.2.1", "192.0.2.1")


class FakeMQTTClient:
    instances = []
    fail_connect = False

    def __init__(self, client_id, server, port=0, user=None, password=None, ssl=False, keepalive=0):
        FakeMQTTClient.instances.append(self)
        self.server = server
        self.subscriptions = []
        self.published = []
        self.sock = None

    def set_callback(self, cb):
        self.cb = cb

    def connect(self, timeout=None):
        if FakeMQTTClient.fail_connect:
            raise OSError("connection refused")

    def subscribe(self, topic):
        self.subscriptions.append(topic)

    def publish(self, topic, payload):
        self.published.append((topic, payload))

    def safe_check_msg(self):
        return None

    def ping(self):
        pass

    def disconnect(self):
        pass


def make_wifi_manager():
    """WiFiManager wired to a FakeWLAN, with millisecond timers."""
    fake = FakeWLAN()
    wm = wifi_manager.WiFiManager()
    wm._wlan = fake
    wm._attempt_timeout_ms = 50
    wm._backoff_start_ms = 20
    wm._backoff_ms = 20
    wm._backoff_cap_ms = 200
    wm._radio_settle_ms = 20
    return wm, fake


def fail_one_attempt(wm, fake):
    """Drive one full attempt->terminal-failure cycle, waiting out backoff."""
    deadline = utime.ticks_add(utime.ticks_ms(), 2000)
    attempts_before = len(fake.connect_calls)
    while len(fake.connect_calls) == attempts_before:
        wm.maintain()  # waits out backoff / radio settle, then attempts
        if utime.ticks_diff(utime.ticks_ms(), deadline) > 0:
            raise AssertionError("no connect attempt within 2s")
        utime.sleep_ms(5)
    fake.status_value = _TERMINAL_STATUS
    failures_before = wm._failures
    while wm._failures == failures_before:
        wm.maintain()
        if utime.ticks_diff(utime.ticks_ms(), deadline) > 0:
            raise AssertionError("attempt did not fail within 2s")
        utime.sleep_ms(5)


class TestWiFiReconnect(unittest.TestCase):
    def test_stays_connected_is_cheap(self):
        wm, fake = make_wifi_manager()
        fake.connected = True
        for _ in range(5):
            self.assertTrue(wm.maintain())
        self.assertEqual(len(fake.connect_calls), 0, "maintain() must not reconnect while up")

    def test_loss_attempt_backoff_recovery(self):
        wm, fake = make_wifi_manager()
        fake.connected = True
        self.assertTrue(wm.maintain())

        print("\n>>> Drop the link: first attempt should fire immediately")
        fake.connected = False
        fake.status_value = None
        self.assertFalse(wm.maintain())
        self.assertEqual(len(fake.connect_calls), 1)

        print(">>> While the attempt is in flight no second connect() happens")
        for _ in range(5):
            wm.maintain()
            utime.sleep_ms(2)
        self.assertEqual(len(fake.connect_calls), 1, "connect() re-called mid-attempt")

        print(">>> Terminal status fails the attempt and schedules backoff")
        fake.status_value = _TERMINAL_STATUS
        wm.maintain()
        self.assertEqual(wm._failures, 1)
        self.assertEqual(len(fake.connect_calls), 1)
        wm.maintain()  # inside backoff window
        self.assertEqual(len(fake.connect_calls), 1, "attempted during backoff")

        print(">>> After backoff a second attempt fires; then the AP returns")
        utime.sleep_ms(30)
        wm.maintain()
        self.assertEqual(len(fake.connect_calls), 2)
        fake.connected = True
        self.assertTrue(wm.maintain())
        self.assertEqual(wm._failures, 0)
        self.assertEqual(wm._backoff_ms, wm._backoff_start_ms)

    def test_connect_exception_is_handled(self):
        wm, fake = make_wifi_manager()
        fake.connected = True
        wm.maintain()
        fake.connected = False
        fake.raise_on_connect = OSError("Wifi Internal Error")
        self.assertFalse(wm.maintain())  # must not raise
        self.assertFalse(wm._connecting)
        self.assertIsNotNone(wm._next_attempt_ms)

    def test_radio_reset_after_repeated_failures(self):
        wm, fake = make_wifi_manager()
        fake.connected = True
        wm.maintain()
        fake.connected = False
        fake.status_value = None

        for _ in range(wm._radio_reset_after):
            fail_one_attempt(wm, fake)
        self.assertTrue(wm._radio_reset_pending)

        print("\n>>> Next attempt window: radio off, settle, then on + connect")
        attempts_before = len(fake.connect_calls)
        fake.active_calls = []
        fake.status_value = None
        deadline = utime.ticks_add(utime.ticks_ms(), 2000)
        while len(fake.connect_calls) == attempts_before:
            wm.maintain()
            if utime.ticks_diff(utime.ticks_ms(), deadline) > 0:
                raise AssertionError("no attempt after radio reset")
            utime.sleep_ms(5)
        self.assertEqual(fake.active_calls[0], False, "radio was not powered off")
        self.assertIn(True, fake.active_calls, "radio was not powered back on")

    def test_no_wifi_configured_is_noop(self):
        wm = wifi_manager.WiFiManager()  # _wlan stays None
        self.assertFalse(wm.maintain())


class TestMQTTReconnect(unittest.TestCase):
    def setUp(self):
        self.wifi_up = [True]
        self.original_client = mqtt_client._PrismoMQTTClient
        self.original_wifi = mqtt_client._wifi_connected
        mqtt_client._PrismoMQTTClient = FakeMQTTClient
        mqtt_client._wifi_connected = lambda: self.wifi_up[0]
        FakeMQTTClient.instances = []
        FakeMQTTClient.fail_connect = False
        state.is_connected = False

    def tearDown(self):
        mqtt_client._PrismoMQTTClient = self.original_client
        mqtt_client._wifi_connected = self.original_wifi
        state.is_connected = False

    def make_client(self):
        m = mqtt_client.PrismoMQTT()
        # IP-literal host: _server_host() resolves it without DNS traffic.
        m.configure("192.0.2.1", 1883, "test_user", "secret")
        m.set_command_callbacks(lambda uid: None, lambda uid: None, lambda a: None, lambda k: None)
        m._reconnect_start_ms = 20
        m._reconnect_backoff_ms = 20
        m._reconnect_cap_ms = 200
        return m

    def test_unconfigured_maintain_is_noop(self):
        m = mqtt_client.PrismoMQTT()
        m.maintain()
        self.assertEqual(len(FakeMQTTClient.instances), 0)

    def test_first_connect_when_wifi_appears(self):
        m = self.make_client()

        print("\n>>> WiFi down: no connection attempts")
        self.wifi_up[0] = False
        for _ in range(3):
            m.maintain()
        self.assertEqual(len(FakeMQTTClient.instances), 0)

        print(">>> WiFi up: maintain() establishes, subscribes and heartbeats")
        self.wifi_up[0] = True
        m.maintain()
        self.assertEqual(len(FakeMQTTClient.instances), 1)
        c = FakeMQTTClient.instances[0]
        self.assertEqual(c.subscriptions, ["prismo/test_user/cmd/#"])
        self.assertEqual(len(c.published), 1)
        topic, payload = c.published[0]
        self.assertEqual(topic, "prismo/test_user/status")
        self.assertIn("uptime_s", payload)
        self.assertTrue(state.is_connected)

    def test_reconnect_backoff_and_recovery(self):
        m = self.make_client()

        print("\n>>> Broker refuses: attempt fails and backs off")
        FakeMQTTClient.fail_connect = True
        m.maintain()
        self.assertIsNone(m._client)
        attempts = len(FakeMQTTClient.instances)
        self.assertEqual(attempts, 1)
        m.maintain()  # inside backoff window
        self.assertEqual(len(FakeMQTTClient.instances), attempts, "attempted during backoff")

        print(">>> After backoff another attempt fires; broker back -> connected")
        utime.sleep_ms(30)
        m.maintain()
        self.assertEqual(len(FakeMQTTClient.instances), attempts + 1)
        FakeMQTTClient.fail_connect = False
        utime.sleep_ms(60)  # past the doubled backoff
        m.maintain()
        self.assertTrue(m.is_connected())
        self.assertEqual(m._consecutive_failures, 0)
        self.assertEqual(m._reconnect_backoff_ms, m._reconnect_start_ms)
        self.assertTrue(state.is_connected)

    def test_wifi_loss_flags_offline_then_recovers(self):
        m = self.make_client()
        m.maintain()
        self.assertTrue(m.is_connected())

        print("\n>>> WiFi drops: client torn down, state offline")
        self.wifi_up[0] = False
        m.maintain()
        self.assertFalse(m.is_connected())
        self.assertFalse(state.is_connected)
        m.maintain()  # offline + wifi down: no attempts
        self.assertEqual(len(FakeMQTTClient.instances), 1)

        print(">>> WiFi returns: reconnect is immediate (backoff was reset)")
        self.wifi_up[0] = True
        m.maintain()
        self.assertTrue(m.is_connected())
        self.assertTrue(state.is_connected)
        self.assertEqual(len(FakeMQTTClient.instances), 2)


if __name__ == '__main__':
    unittest.main()
