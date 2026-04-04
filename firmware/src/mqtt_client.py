import ujson
import utime
from umqtt.simple import MQTTClient
from src import health_log

_client = None
_user = None
_on_add_key = None
_on_trigger = None

# Saved for reconnect
_host = None
_port = None
_password = None
_use_ssl = False

# Unsent log buffer – capped to avoid OOM on long disconnections
_MAX_PENDING = 50
_pending_logs = []

# Exponential backoff for reconnect attempts
_RECONNECT_BACKOFF_MIN_MS = 5_000
_RECONNECT_BACKOFF_MAX_MS = 60_000
_reconnect_backoff_ms = _RECONNECT_BACKOFF_MIN_MS
_last_reconnect_attempt_ms = None


def connect(host, port, user, password, use_ssl=False):
    global _client, _user, _host, _port, _password, _use_ssl
    global _reconnect_backoff_ms, _last_reconnect_attempt_ms
    _user = user
    _host = host
    _port = port
    _password = password
    _use_ssl = use_ssl
    c = MQTTClient(user, host, port=port, user=user, password=password,
                   ssl=use_ssl, keepalive=60)
    c.set_callback(_on_message)
    c.connect()
    _client = c
    _reconnect_backoff_ms = _RECONNECT_BACKOFF_MIN_MS
    _last_reconnect_attempt_ms = None
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
            _on_add_key(data.get("name", ""), data.get("uid", ""))
    elif topic_str == "prismo/{}/cmd/trigger".format(_user):
        if _on_trigger:
            _on_trigger(data.get("action", ""))


def subscribe_commands(on_add_key, on_trigger):
    """Register command handlers and subscribe if already connected."""
    global _on_add_key, _on_trigger
    _on_add_key = on_add_key
    _on_trigger = on_trigger
    if _client and _user:
        _client.subscribe("prismo/{}/cmd/add_key".format(_user))
        _client.subscribe("prismo/{}/cmd/trigger".format(_user))
        health_log.write_info("MQTT subscribed to command topics", user=_user)


def _subscribe_commands_internal():
    """Re-subscribe after a reconnect (handlers already registered)."""
    if _client and _user and (_on_add_key is not None or _on_trigger is not None):
        _client.subscribe("prismo/{}/cmd/add_key".format(_user))
        _client.subscribe("prismo/{}/cmd/trigger".format(_user))


def publish_scan(uid, allowed):
    if _client is None or _user is None:
        return
    topic = "prismo/{}/scan".format(_user)
    payload = ujson.dumps({"uid": uid, "allowed": allowed})
    try:
        _client.publish(topic, payload)
    except Exception as e:
        health_log.write_warn("MQTT publish_scan failed", error=str(e))
        _mark_disconnected()


def publish_log(entry):
    """Forward a structured log entry to MQTT; buffer if disconnected."""
    if _client is None or _user is None:
        if len(_pending_logs) < _MAX_PENDING:
            _pending_logs.append(entry)
        return
    try:
        _client.publish("prismo/{}/logs".format(_user), ujson.dumps(entry))
    except Exception:
        if len(_pending_logs) < _MAX_PENDING:
            _pending_logs.append(entry)
        _mark_disconnected()


def _flush_pending():
    """Publish buffered log entries; stops on first send failure."""
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
    _client = None


def check_msg():
    """Poll the broker for incoming messages. Marks disconnected on error."""
    if _client is None:
        return
    try:
        _client.check_msg()
    except Exception as e:
        health_log.write_warn("MQTT check_msg error", error=str(e))
        _mark_disconnected()


def maintain():
    """
    Call this from the main loop on every iteration.

    - Connected: polls for incoming messages.
    - Disconnected: attempts reconnect with exponential backoff
      (5 s → 10 s → … → 60 s), then re-subscribes and flushes
      any buffered log entries.
    """
    global _reconnect_backoff_ms, _last_reconnect_attempt_ms, _client

    if _client is not None:
        check_msg()
        return

    if _host is None or _user is None:
        return  # MQTT was never configured

    now = utime.ticks_ms()
    if _last_reconnect_attempt_ms is not None:
        elapsed = utime.ticks_diff(now, _last_reconnect_attempt_ms)
        if elapsed < _reconnect_backoff_ms:
            return  # Still in backoff window

    _last_reconnect_attempt_ms = now
    health_log.write_info("MQTT reconnecting",
                           host=_host, backoff_s=_reconnect_backoff_ms // 1000)
    try:
        c = MQTTClient(_user, _host, port=_port, user=_user, password=_password,
                       ssl=_use_ssl, keepalive=60)
        c.set_callback(_on_message)
        c.connect()
        _client = c
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
    if _client:
        try:
            _client.ping()
        except Exception as e:
            health_log.write_warn("MQTT ping failed", error=str(e))
            _mark_disconnected()
