# MQTT Contract

This document outlines the MQTT messaging contract for the Prismo project.

* **Global Topic Prefix:** `prismo`
* **Topic shape:** `prismo/<deviceUuid>/<subtopic>` — the identity segment is each device's UUID (also its MQTT username and DynSec ACL scope), not a human-readable slug.

---

## Device to Server Messages

### `scan`
* **Subtopic:** `scan`
* **Description:** Device reports an NFC card scan result to the server.

**Payload Properties:**
* `uid` (string, required): Hashed NFC card UID
* `allowed` (boolean, required): Whether the key is in the local allowlist
* `machine_active` (boolean, optional): Current machine-mode latch state (only present in machine mode)

---

### `status`
* **Subtopic:** `status`
* **Description:** Periodic heartbeat from the device.

**Payload Properties:**
* `online` (boolean, required)
* `uptime_s` (integer, optional): Seconds since device boot (lets tests distinguish a runtime reconnect from a reboot)
* `keys_checksum` (string, required): `sha256_hex(sorted(local allowlist uids).join(','))` — lets the server detect drift and republish `cmd_sync`

---

## Server to Device Messages

### `cmd_trigger`
* **Subtopic:** `cmd/trigger`
* **Description:** Server triggers a physical action on the device (LED/relay/buzzer).

**Payload Properties:**
* `action` (string, required): Must be one of `["success", "error", "on", "off"]`

---

### `cmd_sync`
* **Subtopic:** `cmd/sync`
* **Description:** Server pushes the full authoritative key list (retained message).

**Payload Properties:**
* `keys` (array of objects, required):
  * `uid` (string, required)
  * `username` (string, optional)
