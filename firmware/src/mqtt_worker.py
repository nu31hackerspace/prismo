"""Background MQTT worker: the sole owner of the MQTT socket.

Runs on its own thread so that WiFi/MQTT reconnection (a blocking DNS + TCP/TLS
handshake, bounded but up to ~15 s) never stalls the NFC scan loop. The reader
thread only enqueues scan events via ScanQueue; every socket touch happens here.

Delivery is best-effort: scans stay queued while offline and flush on reconnect,
but the queue is capped and drops the oldest entry when full — a stale scan is
worth less than a fresh one.
"""

import _thread
import utime
from src import health_log

# Scans published per loop iteration. Bounds how long a backlog can delay the
# next maintain() (heartbeat/ping), mirroring mqtt_client's own flush batching.
_FLUSH_BATCH = 5

# Yield to the reader thread between iterations. Short enough that a reconnect
# reacts promptly, long enough not to spin the CPU.
_POLL_MS = 50


class ScanQueue:
    """Thread-safe, bounded, drop-oldest queue handing scan events from the
    reader thread to the worker thread."""

    def __init__(self, cap=20):
        self._cap = cap
        self._items = []
        self._lock = _thread.allocate_lock()
        # Latches so the "queue full" warning is logged once per overflow burst
        # instead of on every dropped scan.
        self._warned_full = False

    def put(self, uid, allowed, machine_active):
        with self._lock:
            self._items.append((uid, allowed, machine_active))
            overflow = len(self._items) > self._cap
            if overflow:
                self._items.pop(0)
            warn = overflow and not self._warned_full
            if overflow:
                self._warned_full = True
        if warn:
            health_log.write_warn("Scan queue full, dropping oldest", cap=self._cap)

    def pop(self):
        with self._lock:
            if not self._items:
                return None
            self._warned_full = False
            return self._items.pop(0)


def run(mqtt, wifi_manager, queue, enable_mqtt):
    """Worker loop. Never returns; a broad guard keeps a transient error from
    killing the thread and silently ending all connectivity."""
    while True:
        try:
            wifi_manager.maintain()
            if enable_mqtt:
                mqtt.maintain()
                if mqtt.is_connected():
                    for _ in range(_FLUSH_BATCH):
                        evt = queue.pop()
                        if evt is None:
                            break
                        uid, allowed, machine_active = evt
                        mqtt.publish_scan(uid, allowed, machine_active=machine_active)
                        if not mqtt.is_connected():
                            break  # publish dropped the link; retry rest later
        except Exception as e:
            health_log.write_warn("MQTT worker loop error", error=str(e))
        utime.sleep_ms(_POLL_MS)
