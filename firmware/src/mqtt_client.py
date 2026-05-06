import ujson
import utime
import network
from umqtt.robust import MQTTClient as _RobustClient
from src import health_log

class _RobustPrismoMQTT(_RobustClient):
    """umqtt.robust subclass with bounded reconnect for WDT-safe operation."""

    def delay(self, i):
        pass

    def log(self, in_reconnect, e):
        label = "reconnect" if in_reconnect else "operation"
        health_log.write_warn("MQTT robust {}".format(label), error=str(e))

    def reconnect(self):
        try:
            return super(_RobustClient, self).connect(False)
        except OSError as e:
            self.log(True, e)
            raise

    def safe_check_msg(self):
        """Non-blocking message check that never triggers reconnect loops."""
        self.sock.setblocking(False)
        try:
            return super(_RobustClient, self).wait_msg()
        except OSError as e:
            if e.args[0] == 11:  # EAGAIN — no data ready
                return None
            raise

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

        self._on_add_key = None
        self._on_remove_key = None
        self._on_trigger = None
        self._on_sync_keys = None

        self._pending_logs = []
        self._MAX_PENDING = 50

        self._HEARTBEAT_INTERVAL_MS = 5_000
        self._last_heartbeat_ms = None

        self._RECONNECT_BACKOFF_MIN_MS = 5_000
        self._RECONNECT_BACKOFF_MAX_MS = 120_000
        self._reconnect_backoff_ms = self._RECONNECT_BACKOFF_MIN_MS
        self._last_reconnect_attempt_ms = None

        self._PING_INTERVAL_MS = 30_000
        self._last_ping_ms = None

        self._consecutive_failures = 0
        self._MAX_CONSECUTIVE_FAILURES = 3

    def connect(self, host, port, user, password, use_ssl=False):
        self._user = user
        self._host = host
        self._port = port
        self._password = password
        self._use_ssl = use_ssl

        c = _RobustPrismoMQTT(self._user, self._host, port=self._port, user=self._user, password=self._password, ssl=self._use_ssl, keepalive=60)
        c.set_callback(self._on_message)
        c.connect()
        self._client = c
        self._reconnect_backoff_ms = self._RECONNECT_BACKOFF_MIN_MS
        self._last_reconnect_attempt_ms = None
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

        if topic_str == "prismo/{}/cmd/add_key".format(self._user):
            if self._on_add_key:
                self._on_add_key(data.get("uid", ""))
        elif topic_str == "prismo/{}/cmd/remove_key".format(self._user):
            if self._on_remove_key:
                self._on_remove_key(data.get("uid", ""))
        elif topic_str == "prismo/{}/cmd/trigger".format(self._user):
            if self._on_trigger:
                self._on_trigger(data.get("action", ""))
        elif topic_str == "prismo/{}/cmd/sync".format(self._user):
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
            self._client.subscribe("prismo/{}/cmd/add_key".format(self._user))
            self._client.subscribe("prismo/{}/cmd/remove_key".format(self._user))
            self._client.subscribe("prismo/{}/cmd/trigger".format(self._user))
            self._client.subscribe("prismo/{}/cmd/sync".format(self._user))
            health_log.write_info("MQTT subscribed to command topics", user=self._user)
        else:
            health_log.write_error("MQTT client or user not initialized", client=str(self._client), user=self._user)

    def _subscribe_commands_internal(self):
        if self._client and self._user and (self._on_add_key is not None or self._on_remove_key is not None or self._on_trigger is not None):
            self._client.subscribe("prismo/{}/cmd/add_key".format(self._user))
            self._client.subscribe("prismo/{}/cmd/remove_key".format(self._user))
            self._client.subscribe("prismo/{}/cmd/trigger".format(self._user))
            self._client.subscribe("prismo/{}/cmd/sync".format(self._user))

    def publish_heartbeat(self):
        if self._client is None or self._user is None:
            return
        topic = "prismo/{}/status".format(self._user)
        try:
            self._client.publish(topic, ujson.dumps({"online": True}))
            self._last_heartbeat_ms = utime.ticks_ms()
            self._consecutive_failures = 0
        except Exception as e:
            health_log.write_warn("MQTT publish_heartbeat failed", error=str(e))
            self._consecutive_failures += 1
            self._mark_disconnected()

    def publish_scan(self, uid, allowed, machine_active=None):
        if self._client is None or self._user is None:
            return
        topic = "prismo/{}/scan".format(self._user)
        data = {"uid": uid, "allowed": allowed}
        if machine_active is not None:
            data["machine_active"] = machine_active
        payload = ujson.dumps(data)
        try:
            self._client.publish(topic, payload)
            self._consecutive_failures = 0
        except Exception as e:
            health_log.write_warn("MQTT publish_scan failed", error=str(e))
            self._consecutive_failures += 1
            self._mark_disconnected()

    def publish_log(self, entry):
        if self._client is None or self._user is None:
            if len(self._pending_logs) < self._MAX_PENDING:
                self._pending_logs.append(entry)
            return
        try:
            self._client.publish("prismo/{}/logs".format(self._user), ujson.dumps(entry))
            self._consecutive_failures = 0
        except Exception:
            if len(self._pending_logs) < self._MAX_PENDING:
                self._pending_logs.append(entry)
            self._consecutive_failures += 1
            self._mark_disconnected()

    def _flush_pending(self):
        if not self._pending_logs or self._client is None or self._user is None:
            return
        topic = "prismo/{}/logs".format(self._user)
        remaining = list(self._pending_logs)
        sent = 0
        while remaining:
            entry = remaining[0]
            try:
                self._client.publish(topic, ujson.dumps(entry))
                remaining.pop(0)
                sent += 1
            except Exception:
                self._mark_disconnected()
                break
        self._pending_logs = remaining
        if sent:
            health_log.write_info("MQTT flushed buffered logs", count=sent, still_pending=len(self._pending_logs))

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

    def maintain(self):
        if self._client is not None:
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
                health_log.write_warn("MQTT too many consecutive failures, forcing reconnect", failures=self._consecutive_failures)
                self._mark_disconnected()
            return

        if self._host is None or self._user is None:
            return

        if not _wifi_connected():
            return

        now = utime.ticks_ms()
        if self._last_reconnect_attempt_ms is not None:
            elapsed = utime.ticks_diff(now, self._last_reconnect_attempt_ms)
            if elapsed < self._reconnect_backoff_ms:
                return

        self._last_reconnect_attempt_ms = now
        health_log.write_info("MQTT reconnecting", host=self._host, backoff_s=self._reconnect_backoff_ms // 1000)
        try:
            c = _RobustPrismoMQTT(self._user, self._host, port=self._port, user=self._user, password=self._password, ssl=self._use_ssl, keepalive=60)
            c.set_callback(self._on_message)
            c.connect()
            self._client = c
            self._consecutive_failures = 0
            self._last_ping_ms = utime.ticks_ms()
            self._last_heartbeat_ms = None  # send heartbeat immediately on next maintain()
            self._subscribe_commands_internal()
            health_log.write_info("MQTT reconnected", host=self._host, pending_logs=len(self._pending_logs))
            self._reconnect_backoff_ms = self._RECONNECT_BACKOFF_MIN_MS
            self._flush_pending()
        except Exception as e:
            next_backoff = min(self._reconnect_backoff_ms * 2, self._RECONNECT_BACKOFF_MAX_MS)
            health_log.write_warn("MQTT reconnect failed", error=str(e), next_retry_s=next_backoff // 1000)
            self._reconnect_backoff_ms = next_backoff

    def ping(self):
        self._do_ping()

    def is_connected(self):
        return self._client is not None
