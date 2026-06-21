import ujson
import utime
import network
import socket
from umqtt.simple import MQTTClient as _SimpleClient
from src import health_log
from src.mqtt_contract import (
    device_topic, SUBTOPIC_SCAN, SUBTOPIC_STATUS, SUBTOPIC_CMD_ADD_KEY, SUBTOPIC_CMD_REMOVE_KEY, SUBTOPIC_CMD_TRIGGER,
    SUBTOPIC_CMD_SYNC,
)

# Hard ceiling on any single blocking socket operation (connect, CONNACK read,
# publish, ping). Keeps a poor link from stalling the shared loop for long;
# well under the 30 s watchdog so a slow op can never freeze the door reader.
_SOCKET_TIMEOUT_S = 3


class _PrismoMQTTClient(_SimpleClient):
    """umqtt.simple subclass: non-blocking message check with bounded socket IO.
    No auto-reconnect — a failed op surfaces so the caller can mark the device
    offline instead of silently blocking on a hidden reconnect."""

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

    def connect(self, host, port, user, password, use_ssl=False):
        self._user = user
        self._host = host
        self._port = port
        self._password = password
        self._use_ssl = use_ssl

        c = self._new_client()
        self._client = c
        self._last_ping_ms = utime.ticks_ms()
        self._consecutive_failures = 0
        health_log.write_info("MQTT connected", host=self._host, user=self._user)
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

    def subscribe_commands(self, on_add_key, on_remove_key, on_trigger, on_sync_keys=None):
        health_log.write_info("subscribe_commands")
        self._on_add_key = on_add_key
        self._on_remove_key = on_remove_key
        self._on_trigger = on_trigger
        self._on_sync_keys = on_sync_keys

        if self._client and self._user:
            health_log.write_info("Subscribing to command topics", user=self._user)
            self._client.subscribe(device_topic(self._user, SUBTOPIC_CMD_ADD_KEY))
            self._client.subscribe(device_topic(self._user, SUBTOPIC_CMD_REMOVE_KEY))
            self._client.subscribe(device_topic(self._user, SUBTOPIC_CMD_TRIGGER))
            self._client.subscribe(device_topic(self._user, SUBTOPIC_CMD_SYNC))
            health_log.write_info("MQTT subscribed to command topics", user=self._user)
        else:
            health_log.write_error("MQTT client or user not initialized", client=str(self._client), user=self._user)

    def publish_heartbeat(self):
        if self._client is None or self._user is None:
            return
        topic = device_topic(self._user, SUBTOPIC_STATUS)
        try:
            self._client.publish(topic, ujson.dumps({"online": True}))
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
        """Tear down the link and flag the device offline. Safe mode never
        reconnects on its own — the device stays offline until the next reboot."""
        self._mark_disconnected()
        from src import state
        state.set_connected(False, reason=reason)

    def maintain(self):
        # Safe mode: once offline, do nothing. No background reconnect, so the
        # reader loop is never blocked by a connect attempt on a poor link.
        if self._client is None:
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
