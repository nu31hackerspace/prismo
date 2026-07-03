import network
import gc
from src import config
from src import health_log
import utime

_STAT_CONNECTING = getattr(network, "STAT_CONNECTING", 1001)


class WiFiManager:
    # Runtime reconnect tuning. Class-level so unit tests can shrink them per
    # instance by plain attribute assignment.
    _attempt_timeout_ms = 15_000   # association + DHCP window per async attempt
    _backoff_start_ms = 5_000
    _backoff_cap_ms = 60_000       # retry forever, capped
    _radio_reset_after = 4         # failed attempts before toggling wlan.active()
    _radio_settle_ms = 1_000

    def __init__(self):
        health_log.write_info("init wifi manager")
        self._wlan = None
        # Reconnect state driven by maintain(). _connecting means an async
        # wlan.connect() attempt is in flight inside the ESP-IDF WiFi task.
        self._connecting = False
        self._attempt_started_ms = 0
        self._failures = 0
        self._was_connected = False
        self._next_attempt_ms = None
        self._radio_reset_pending = False
        self._backoff_ms = self._backoff_start_ms

    def _ensure_wlan(self):
        if self._wlan is None:
            gc.collect()
            self._wlan = network.WLAN(network.STA_IF)
            self._wlan.active(True)
            self._wlan.config(txpower=8.5)
        return self._wlan

    def _status_safe(self):
        try:
            return self._wlan.status()
        except Exception:
            return None

    def _abort_attempt(self):
        """Cancel any in-flight IDF association so the next connect() call
        cannot collide with it ("Wifi Internal Error")."""
        try:
            self._wlan.disconnect()
        except Exception:
            pass

    def is_connected(self):
        return self._wlan is not None and self._wlan.isconnected()

    def connect(self, on_attempt=None, on_complete=None):
        """Blocking boot connect: bounded attempts with LED feedback.
        Runtime recovery is handled by maintain(). Returns True if connected."""
        if not config.has_wifi():
            # Surface the raw baked value so we can tell apart an empty
            # substitution ("") from an un-substituted template
            # ("{{WIFI_SSID}}") when the device reports no WiFi.
            health_log.write_error("No WiFi configured", raw_ssid=repr(config.WIFI_SSID))
            return False

        wlan_sta = self._ensure_wlan()
        ssid, password = config.get_wifi()

        health_log.write_info("Connecting to WiFi", ssid=ssid)
        wlan_sta.connect(ssid, password)
        self._connecting = True
        self._attempt_started_ms = utime.ticks_ms()

        attempts = config.WIFI_CONNECT_ATTEMPTS
        while attempts > 0 and not wlan_sta.isconnected():
            health_log.write_info("Try connecting to WiFi", keep_try=attempts)

            attempts -= 1
            utime.sleep_ms(1000)
            if on_attempt:
                on_attempt()

        if on_complete:
            on_complete()

        if wlan_sta.isconnected():
            self._connecting = False
            self._was_connected = True
            health_log.write_info("WiFi connected", ip=wlan_sta.ifconfig()[0], ssid=ssid)
            return True

        # Leave _connecting=True with its start timestamp: the attempt kicked
        # off above may still be running inside the IDF WiFi task. maintain()
        # waits out the attempt window before retrying.
        health_log.write_error("WiFi connect failed", ssid=ssid)
        return False

    def _schedule_backoff(self, now):
        self._next_attempt_ms = utime.ticks_add(now, self._backoff_ms)
        self._backoff_ms = min(self._backoff_ms * 2, self._backoff_cap_ms)

    def maintain(self):
        """Tick-driven reconnect, called from the reader loop. Never sleeps or
        loops: wlan.connect() is asynchronous on the esp32 port (the ESP-IDF
        WiFi task associates in the background), so each call here costs
        microseconds and the NFC loop is never starved. Returns True while
        WiFi is up."""
        if self._wlan is None:
            return False  # no WiFi configured / boot connect never ran

        if self._wlan.isconnected():
            if self._connecting or self._failures:
                health_log.write_info("WiFi reconnected", ip=self._wlan.ifconfig()[0])
            self._connecting = False
            self._failures = 0
            self._backoff_ms = self._backoff_start_ms
            self._next_attempt_ms = None
            self._radio_reset_pending = False
            self._was_connected = True
            return True

        now = utime.ticks_ms()

        if self._was_connected:  # log the loss exactly once
            self._was_connected = False
            health_log.write_warn("WiFi link lost", status=self._status_safe())

        if self._connecting:
            elapsed = utime.ticks_diff(now, self._attempt_started_ms)
            st = self._status_safe()
            if elapsed < self._attempt_timeout_ms and st in (_STAT_CONNECTING, None):
                return False  # attempt still in flight — let the IDF work
            if st in (_STAT_CONNECTING, None):
                # Window expired but the IDF is still trying: cancel it, or the
                # next connect() would land on top of the live attempt.
                self._abort_attempt()
            self._connecting = False
            self._failures += 1
            # First failure and every power of two afterwards: enough evidence
            # for diagnosis without churning the rotating flash log during a
            # weeks-long outage.
            if self._failures & (self._failures - 1) == 0:
                health_log.write_warn("WiFi reconnect attempt failed", failures=self._failures, status=st)
            self._schedule_backoff(now)
            if self._failures % self._radio_reset_after == 0:
                self._radio_reset_pending = True
            return False

        if self._next_attempt_ms is not None and utime.ticks_diff(now, self._next_attempt_ms) < 0:
            return False  # backing off

        try:
            if self._radio_reset_pending:
                # Radio recovery, split across ticks: power the interface off
                # now, let it settle, reactivate on the next attempt below.
                self._wlan.active(False)
                self._radio_reset_pending = False
                self._next_attempt_ms = utime.ticks_add(now, self._radio_settle_ms)
                return False
            if not self._wlan.active():
                self._wlan.active(True)
                self._wlan.config(txpower=8.5)
            ssid, password = config.get_wifi()
            self._wlan.connect(ssid, password)
            self._connecting = True
            self._attempt_started_ms = now
        except Exception as e:  # e.g. "Wifi Internal Error" mid-attempt
            health_log.write_warn("WiFi reconnect error", error=str(e))
            self._abort_attempt()
            self._connecting = False
            self._schedule_backoff(now)
        return False
