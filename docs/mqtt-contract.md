# MQTT Contract

This document outlines the MQTT messaging contract for the Prismo project.

* **Global Topic Prefix:** `prismo`

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

---

## Server to Device Messages

### `cmd_add_key`
* **Subtopic:** `cmd/add_key`
* **Description:** Server instructs device to add a key to the local allowlist.

**Payload Properties:**
* `uid` (string, required)

---

### `cmd_remove_key`
* **Subtopic:** `cmd/remove_key`
* **Description:** Server instructs device to remove a key from the local allowlist.

**Payload Properties:**
* `uid` (string, required)

---

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
