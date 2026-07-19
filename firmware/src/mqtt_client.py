import ujson
import utime
import network
import socket
import gc
from umqtt.simple import MQTTClient as _SimpleClient
from src import health_log
from src.mqtt_contract import (
    device_topic, SUBTOPIC_SCAN, SUBTOPIC_STATUS, SUBTOPIC_CMD_ADD_KEY, SUBTOPIC_CMD_REMOVE_KEY, SUBTOPIC_CMD_TRIGGER,
    SUBTOPIC_CMD_SYNC,
)

# Hard ceiling on any single blocking socket operation (connect, CONNACK read,
# publish, ping). Keeps a poor link from stalling the shared loop for long. A
# full _establish() is a handful of these ops, so its worst case stays under
# the 20 s watchdog.
_SOCKET_TIMEOUT_S = 3


class _PrismoMQTTClient(_SimpleClient):
    """umqtt.simple subclass: non-blocking message check with bounded socket IO.
    No hidden auto-reconnect inside socket ops — a failed op surfaces so the
    caller can mark the device offline and schedule a bounded reconnect."""

    def safe_check_msg(self):
        self.sock.setblocking(False)
        try:
            return super().wait_msg()
        except OSError as e:
            if e.args[0] == 11:  # EAGAIN — no data ready
                return None
            raise
        finally:
            # Restore bounded-blocking mode so later publishes/pings get a
            # timeout instead of failing instantly with EAGAIN.
            try:
                self.sock.settimeout(_SOCKET_TIMEOUT_S)
            except Exception:
                pass

def _wifi_connected():
    try:
        sta = network.WLAN(network.STA_IF)
        return sta.active() and sta.isconnected()
    except Exception:
        return False


class PrismoMQTT:
    """Contract handler class for MQTT communications, maintaining connection info, callbacks and logs."""

    # Runtime reconnect backoff (maintain() retries forever, capped).
    # Class-level so unit tests can shrink them per instance.
    _reconnect_start_ms = 5_000
    _reconnect_cap_ms = 30_000

    def __init__(self):
        self._client = None
        self._user = None
        self._host = None
        self._port = None
        self._password = None
        self._use_ssl = False
        # Cached broker IP so repeated reconnects skip a blocking DNS lookup.
        self._resolved_host = None

        self._on_add_key = None
        self._on_remove_key = None
        self._on_trigger = None
        self._on_sync_keys = None

        self._pending_logs = []
        self._MAX_PENDING = 50
        # Cap how many buffered logs go out per maintain() so flushing a full
        # backlog can't monopolise the loop on a slow link.
        self._FLUSH_BATCH = 5

        self._HEARTBEAT_INTERVAL_MS = 5_000
        self._last_heartbeat_ms = None

        self._PING_INTERVAL_MS = 30_000
        self._last_ping_ms = None

        self._consecutive_failures = 0
        self._MAX_CONSECUTIVE_FAILURES = 3

        self._reconnect_backoff_ms = self._reconnect_start_ms
        self._reconnect_failures = 0
        self._next_reconnect_ms = None
        self._reconnects = 0

    def _server_host(self):
        """Broker address to dial: a cached IP when possible to avoid repeated
        DNS, but the hostname for TLS so SNI/cert validation still works."""
        if self._use_ssl:
            return self._host
        if self._resolved_host is None:
            try:
                self._resolved_host = socket.getaddrinfo(self._host, self._port)[0][-1][0]
            except Exception:
                self._resolved_host = None
        return self._resolved_host or self._host

    def _new_client(self):
        """Build a client and connect with every blocking step time-bounded."""
        c = _PrismoMQTTClient(self._user, self._server_host(), port=self._port, user=self._user, password=self._password, ssl=self._use_ssl, keepalive=60)
        c.set_callback(self._on_message)
        try:
            c.connect(timeout=_SOCKET_TIMEOUT_S)
        except TypeError:
            # Older umqtt without a connect timeout kwarg.
            c.connect()
        try:
            c.sock.settimeout(_SOCKET_TIMEOUT_S)
        except Exception:
            pass
        return c

    def configure(self, host, port, user, password, use_ssl=False):
        """Store connection parameters without connecting. Must be called even
        when the boot connect is skipped (e.g. WiFi down at boot) so maintain()
        can establish the first connection once the network appears."""
        self._user = user
        self._host = host
        self._port = port
        self._password = password
        self._use_ssl = use_ssl

    def connect_now(self):
        """Boot entry point: one bounded connect attempt. Raises on failure so
        the boot retry loop can decide; runtime retries go through maintain()."""
        self._establish()

    def _establish(self):
        """Single connect path for boot and runtime: build a client, subscribe
        the command topics, heartbeat right away and flag the device online.
        Every blocking step is bounded by _SOCKET_TIMEOUT_S."""
        gc.collect()  # reconnect churn: keep the heap tidy before allocating
        try:
            c = self._new_client()
            self._client = c
            self._last_ping_ms = utime.ticks_ms()
            self._consecutive_failures = 0
            self._subscribe_topics()
            self.publish_heartbeat()  # prompt Online flip server-side
            if self._client is None:
                # publish_heartbeat swallows errors and drops the client.
                raise OSError("MQTT connect: first heartbeat failed")
        except Exception:
            self._mark_disconnected()  # never leave a half-open socket behind
            raise
        self._reconnects += 1
        from src import state
        state.set_connected(True)
        health_log.write_info("MQTT connected", host=self._host, user=self._user, reconnects=self._reconnects)
        return c

    def _on_message(self, topic, msg):
        if self._user is None:
            return
        topic_str = topic.decode() if isinstance(topic, bytes) else topic
        try:
            data = ujson.loads(msg)
        except Exception:
            data = {}

        if topic_str == device_topic(self._user, SUBTOPIC_CMD_ADD_KEY):
            if self._on_add_key:
                self._on_add_key(data.get("uid", ""))
        elif topic_str == device_topic(self._user, SUBTOPIC_CMD_REMOVE_KEY):
            if self._on_remove_key:
                self._on_remove_key(data.get("uid", ""))
        elif topic_str == device_topic(self._user, SUBTOPIC_CMD_TRIGGER):
            if self._on_trigger:
                self._on_trigger(data.get("action", ""))
        elif topic_str == device_topic(self._user, SUBTOPIC_CMD_SYNC):
            if self._on_sync_keys:
                self._on_sync_keys(data.get("keys", []))

    def set_command_callbacks(self, on_add_key, on_remove_key, on_trigger, on_sync_keys=None):
        """Store the command handlers. Topic subscription happens on every
        (re)connect in _establish(), so callbacks survive connection churn."""
        self._on_add_key = on_add_key
        self._on_remove_key = on_remove_key
        self._on_trigger = on_trigger
        self._on_sync_keys = on_sync_keys

    def _subscribe_topics(self):
        if not (self._client and self._user):
            health_log.write_error("MQTT client or user not initialized", client=str(self._client), user=self._user)
            return
        # One wildcard covers every cmd/* topic (_on_message dispatches by the
        # exact topic), so (re)connecting waits for a single SUBACK instead of
        # four — that keeps _establish()'s blocking budget under the watchdog.
        self._client.subscribe(device_topic(self._user, "cmd/#"))
        health_log.write_info("MQTT subscribed to command topics", user=self._user)

    def publish_heartbeat(self):
        if self._client is None or self._user is None:
            return
        topic = device_topic(self._user, SUBTOPIC_STATUS)
        try:
            self._client.publish(topic, ujson.dumps({"online": True, "uptime_s": health_log.uptime_s()}))
            self._last_heartbeat_ms = utime.ticks_ms()
            self._consecutive_failures = 0
        except Exception as e:
            health_log.write_warn("MQTT publish_heartbeat failed", error=str(e))
            self._consecutive_failures += 1
            self._mark_disconnected()

    def publish_scan(self, uid, allowed, machine_active=None):
        health_log.write_info("MQTT publish_scan call client ", client = self._client, user = self._user)
        if self._client is None or self._user is None:
            return
        topic = device_topic(self._user, SUBTOPIC_SCAN)
        data = {"uid": uid, "allowed": allowed}
        if machine_active is not None:
            data["machine_active"] = machine_active
        payload = ujson.dumps(data)
        try:
            self._client.publish(topic, payload)
            self._consecutive_failures = 0
            health_log.write_info("MQTT publish_scan publish")
        except Exception as e:
            health_log.write_warn("MQTT publish_scan failed", error=str(e))
            self._consecutive_failures += 1
            self._mark_disconnected()

    def _mark_disconnected(self):
        if self._client is not None:
            try:
                self._client.disconnect()
            except Exception:
                pass
            try:
                if hasattr(self._client, 'sock') and self._client.sock:
                    self._client.sock.close()
            except Exception:
                pass
        self._client = None

    def check_msg(self):
        if self._client is None:
            return
        try:
            self._client.safe_check_msg()
            self._consecutive_failures = 0
        except Exception as e:
            health_log.write_warn("MQTT check_msg error", error=str(e))
            self._consecutive_failures += 1
            self._mark_disconnected()

    def _do_ping(self):
        if self._client is None:
            return
        try:
            self._client.ping()
            self._last_ping_ms = utime.ticks_ms()
            self._consecutive_failures = 0
        except Exception as e:
            health_log.write_warn("MQTT ping failed", error=str(e))
            self._consecutive_failures += 1
            self._mark_disconnected()

    def _lose(self, reason):
        """Tear down the link and flag the device offline. maintain() keeps
        retrying with capped backoff, so this is a state flip, not a verdict."""
        self._mark_disconnected()
        from src import state
        state.set_connected(False, reason=reason)

    def _try_reconnect(self):
        """Rate-limited reconnect, driven by maintain() while offline. A failed
        attempt blocks the loop for a few seconds at most (bounded socket ops),
        and backoff keeps such ticks rare."""
        if not _wifi_connected():
            # No link: don't burn attempts. Reset the timers so the first
            # attempt fires immediately once WiFi is back.
            self._next_reconnect_ms = None
            self._reconnect_backoff_ms = self._reconnect_start_ms
            self._reconnect_failures = 0
            return
        now = utime.ticks_ms()
        if self._next_reconnect_ms is not None and utime.ticks_diff(now, self._next_reconnect_ms) < 0:
            return
        try:
            self._establish()
            self._next_reconnect_ms = None
            self._reconnect_backoff_ms = self._reconnect_start_ms
            self._reconnect_failures = 0
        except Exception as e:
            self._reconnect_failures += 1
            # First failure and every power of two afterwards — evidence
            # without churning the rotating flash log during a long outage.
            if self._reconnect_failures & (self._reconnect_failures - 1) == 0:
                health_log.write_warn("MQTT reconnect failed", failures=self._reconnect_failures, error=str(e))
            self._resolved_host = None  # broker IP may have changed; re-resolve
            self._next_reconnect_ms = utime.ticks_add(now, self._reconnect_backoff_ms)
            self._reconnect_backoff_ms = min(self._reconnect_backoff_ms * 2, self._reconnect_cap_ms)

    def maintain(self):
        if self._host is None:
            return  # MQTT never configured (no creds / disabled)

        if self._client is None:
            self._try_reconnect()
            return

        if not _wifi_connected():
            self._lose("wifi")
            return

        self.check_msg()

        if self._client is not None:
            now = utime.ticks_ms()
            if self._last_ping_ms is None or utime.ticks_diff(now, self._last_ping_ms) >= self._PING_INTERVAL_MS:
                self._do_ping()

        if self._client is not None:
            now = utime.ticks_ms()
            if self._last_heartbeat_ms is None or utime.ticks_diff(now, self._last_heartbeat_ms) >= self._HEARTBEAT_INTERVAL_MS:
                self.publish_heartbeat()

        if self._client is not None and self._consecutive_failures >= self._MAX_CONSECUTIVE_FAILURES:
            health_log.write_warn("MQTT too many consecutive failures", failures=self._consecutive_failures)
            self._mark_disconnected()

        if self._client is None:
            self._lose("mqtt")

    def ping(self):
        self._do_ping()

    def is_connected(self):
        return self._client is not None
