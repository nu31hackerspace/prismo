import ujson
import utime
import network
from umqtt.robust import MQTTClient as _RobustClient
from src import health_log

_client = None
_user = None
_on_add_key = None
_on_remove_key = None
_on_trigger = None

_host = None
_port = None
_password = None
_use_ssl = False

_MAX_PENDING = 50
_pending_logs = []

_RECONNECT_BACKOFF_MIN_MS = 5_000
_RECONNECT_BACKOFF_MAX_MS = 120_000
_reconnect_backoff_ms = _RECONNECT_BACKOFF_MIN_MS
_last_reconnect_attempt_ms = None

_PING_INTERVAL_MS = 30_000
_last_ping_ms = None

_consecutive_failures = 0
_MAX_CONSECUTIVE_FAILURES = 3


class _PrismoMQTT(_RobustClient):
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
            # Call simple.MQTTClient.wait_msg directly to skip robust's retry loop
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


def connect(host, port, user, password, use_ssl=False):
    global _client, _user, _host, _port, _password, _use_ssl
    global _reconnect_backoff_ms, _last_reconnect_attempt_ms
    global _last_ping_ms, _consecutive_failures
    _user = user
    _host = host
    _port = port
    _password = password
    _use_ssl = use_ssl

    c = _PrismoMQTT(user, host, port=port, user=user, password=password,
                     ssl=use_ssl, keepalive=60)
    c.set_callback(_on_message)
    c.connect()
    _client = c
    _reconnect_backoff_ms = _RECONNECT_BACKOFF_MIN_MS
    _last_reconnect_attempt_ms = None
    _last_ping_ms = utime.ticks_ms()
    _consecutive_failures = 0
    health_log.write_info("MQTT connected", host=host, user=user)
    return c


def _on_message(topic, msg):
    if _user is None:
        return
    topic_str = topic.decode() if isinstance(topic, bytes) else topic
    try:
        data = ujson.loads(msg)
    except Exception:
        data = {}

    if topic_str == "prismo/{}/cmd/add_key".format(_user):
        if _on_add_key:
            _on_add_key(data.get("uid", ""))
    elif topic_str == "prismo/{}/cmd/remove_key".format(_user):
        if _on_remove_key:
            _on_remove_key(data.get("uid", ""))
    elif topic_str == "prismo/{}/cmd/trigger".format(_user):
        if _on_trigger:
            _on_trigger(data.get("action", ""))

def subscribe_commands(on_add_key, on_remove_key, on_trigger):
    global _on_add_key, _on_remove_key, _on_trigger
    _on_add_key = on_add_key
    _on_remove_key = on_remove_key
    _on_trigger = on_trigger
    if _client and _user:
        _client.subscribe("prismo/{}/cmd/add_key".format(_user))
        _client.subscribe("prismo/{}/cmd/remove_key".format(_user))
        _client.subscribe("prismo/{}/cmd/trigger".format(_user))
        health_log.write_info("MQTT subscribed to command topics", user=_user)

def _subscribe_commands_internal():
    if _client and _user and (_on_add_key is not None or _on_remove_key is not None or _on_trigger is not None):
        _client.subscribe("prismo/{}/cmd/add_key".format(_user))
        _client.subscribe("prismo/{}/cmd/remove_key".format(_user))
        _client.subscribe("prismo/{}/cmd/trigger".format(_user))


def publish_scan(uid, allowed):
    global _consecutive_failures
    if _client is None or _user is None:
        return
    topic = "prismo/{}/scan".format(_user)
    payload = ujson.dumps({"uid": uid, "allowed": allowed})
    try:
        _client.publish(topic, payload)
        _consecutive_failures = 0
    except Exception as e:
        health_log.write_warn("MQTT publish_scan failed", error=str(e))
        _consecutive_failures += 1
        _mark_disconnected()


def publish_log(entry):
    global _consecutive_failures
    if _client is None or _user is None:
        if len(_pending_logs) < _MAX_PENDING:
            _pending_logs.append(entry)
        return
    try:
        _client.publish("prismo/{}/logs".format(_user), ujson.dumps(entry))
        _consecutive_failures = 0
    except Exception:
        if len(_pending_logs) < _MAX_PENDING:
            _pending_logs.append(entry)
        _consecutive_failures += 1
        _mark_disconnected()


def _flush_pending():
    global _pending_logs
    if not _pending_logs or _client is None or _user is None:
        return
    topic = "prismo/{}/logs".format(_user)
    remaining = list(_pending_logs)
    sent = 0
    while remaining:
        entry = remaining[0]
        try:
            _client.publish(topic, ujson.dumps(entry))
            remaining.pop(0)
            sent += 1
        except Exception:
            _mark_disconnected()
            break
    _pending_logs = remaining
    if sent:
        health_log.write_info("MQTT flushed buffered logs", count=sent,
                               still_pending=len(_pending_logs))


def _mark_disconnected():
    global _client
    if _client is not None:
        try:
            _client.disconnect()
        except Exception:
            pass
        try:
            if hasattr(_client, 'sock') and _client.sock:
                _client.sock.close()
        except Exception:
            pass
    _client = None


def check_msg():
    global _consecutive_failures
    if _client is None:
        return
    try:
        _client.safe_check_msg()
        _consecutive_failures = 0
    except Exception as e:
        health_log.write_warn("MQTT check_msg error", error=str(e))
        _consecutive_failures += 1
        _mark_disconnected()


def _do_ping():
    global _last_ping_ms, _consecutive_failures
    if _client is None:
        return
    try:
        _client.ping()
        _last_ping_ms = utime.ticks_ms()
        _consecutive_failures = 0
    except Exception as e:
        health_log.write_warn("MQTT ping failed", error=str(e))
        _consecutive_failures += 1
        _mark_disconnected()


def maintain():
    global _reconnect_backoff_ms, _last_reconnect_attempt_ms, _client
    global _last_ping_ms, _consecutive_failures

    if _client is not None:
        check_msg()

        if _client is not None:
            now = utime.ticks_ms()
            if _last_ping_ms is None or utime.ticks_diff(now, _last_ping_ms) >= _PING_INTERVAL_MS:
                _do_ping()

        if _client is not None and _consecutive_failures >= _MAX_CONSECUTIVE_FAILURES:
            health_log.write_warn("MQTT too many consecutive failures, forcing reconnect",
                                   failures=_consecutive_failures)
            _mark_disconnected()
        return

    if _host is None or _user is None:
        return

    if not _wifi_connected():
        return

    now = utime.ticks_ms()
    if _last_reconnect_attempt_ms is not None:
        elapsed = utime.ticks_diff(now, _last_reconnect_attempt_ms)
        if elapsed < _reconnect_backoff_ms:
            return

    _last_reconnect_attempt_ms = now
    health_log.write_info("MQTT reconnecting",
                           host=_host, backoff_s=_reconnect_backoff_ms // 1000)
    try:
        c = _PrismoMQTT(_user, _host, port=_port, user=_user, password=_password,
                         ssl=_use_ssl, keepalive=60)
        c.set_callback(_on_message)
        c.connect()
        _client = c
        _consecutive_failures = 0
        _last_ping_ms = utime.ticks_ms()
        _subscribe_commands_internal()
        health_log.write_info("MQTT reconnected", host=_host,
                               pending_logs=len(_pending_logs))
        _reconnect_backoff_ms = _RECONNECT_BACKOFF_MIN_MS
        _flush_pending()
    except Exception as e:
        next_backoff = min(_reconnect_backoff_ms * 2, _RECONNECT_BACKOFF_MAX_MS)
        health_log.write_warn("MQTT reconnect failed", error=str(e),
                               next_retry_s=next_backoff // 1000)
        _reconnect_backoff_ms = next_backoff


def ping():
    _do_ping()


def is_connected():
    return _client is not None
