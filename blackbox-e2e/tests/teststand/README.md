# Hardware test-stand e2e

A fully black-box, hardware-in-the-loop end-to-end test. It runs the **production**
web stack, drives the UI as a real user, flashes the **real** ESP32-C3 connected
to the Raspberry Pi, and asserts on the **physical** success output pin.

```
┌── Raspberry Pi (test stand) ─────────────────────────────────────────────┐
│                                                                           │
│  WiFi hotspot (nmcli, 2.4 GHz)            docker compose (blackbox-e2e)    │
│        ▲                                   mongo · mqtt · web (prod build) │
│        │ joins                                   ▲                         │
│        │                            Playwright   │ seeds session + clicks  │
│   ESP32-C3 ──USB──► /dev/ttyESP32C3   (this suite)│                         │
│    │   │ GPIO 5 (success)                                                  │
│    │   ▼                                                                   │
│    │  relay (isolated) ──► Pi BCM 17 ◄── gpioget reads here                │
│    │ RF (~1-3 cm)                                                          │
│   PN532 tag emulator (2nd ESP32-C3) ──USB──► /dev/ttyTagEmulator           │
└───────────────────────────────────────────────────────────────────────────┘
```

## What it does

There is a single spec, `device-lifecycle.spec.ts`, that runs the whole
journey against the real device (one firmware build + flash, shared by every
phase):

1. **Seed auth** — inserts a user + session into Mongo and mints the session
   cookie (the _only_ black-box exception, to skip Google OAuth). See
   `lib/seed-auth.ts`.
2. **Create device** through the UI, **Generate Token** (real MQTT creds), set
   the WiFi credentials, **Build Firmware** on the Pi worker, **Download** it.
3. **Flash** the ESP32-C3 with `esptool` (erase + write the downloaded binary).
4. Assert the UI shows **Online** (real MQTT heartbeats) and that **Trigger
   Success** → MQTT `cmd/trigger` → firmware drives GPIO 5 HIGH → relay closes
   → Pi reads the line active (`lib/gpio.ts`).
5. **Real NFC access** — the PN532 **tag emulator** (a second ESP32-C3, see
   `../../tag-emulator/`) radiates a tag at the reader over real RF. The
   unknown tag is **denied** (pin stays quiet) and surfaces in the UI's "Last
   Unauthorized Scan" panel; the test names it and clicks **Add**; the same
   tag then **opens the door** (pin active) and the history logs the allowed
   scan with the name. The emulator is provisioned fresh each run over
   `/dev/ttyTagEmulator` (`lib/tag-emulator.ts`).
6. **WiFi AP outage** — switch the Pi hotspot off then on; while the backend is
   unreachable, the authorized tag still opens the door from the
   **device-local allowlist**; then assert the device flips Offline,
   reconnects to Online **without rebooting**, and the trigger still drives
   the pin.
7. **Broker outage** — stop then start the MQTT container (WiFi stays up); same
   Offline → reconnect → trigger assertions (the MQTT-only recovery path).
8. **Boot with no AP** — switch the hotspot off, reset the board, confirm it
   boots Offline (NFC runs on the local allowlist), then switch the hotspot on
   and assert the device makes its **first** connection and the trigger works.
9. **Key removal** — remove the key through the UI; the same tag is denied
   again (history shows the denied scan, pin stays quiet).

Mechanics: the AP is toggled with `sudo nmcli connection down/up prismo-ap`
(`lib/wifi.ts`; requires passwordless sudo — the CI runner has it, locally use
`sudo -E npm run teststand:run`). "Without rebooting" is proven by the
`uptime_s` field in the device's status heartbeat staying monotonic across the
outage (`lib/status-watcher.ts` subscribes on the broker's docker-published
port, which a wlan0 outage does not affect). Each phase is a Playwright
`test.step`, so the HTML report shows which phase failed.

## One-time stand setup

- Wire the relay per [`test-stand/README.md`](../../README.md).
- Create the `/dev/ttyESP32C3` and `/dev/ttyTagEmulator` udev symlinks (see
  that README — the two boards share a VID:PID, so the rules must match each
  board's USB serial).
- Prepare the tag-emulator board (stock MicroPython, antenna coupled to the
  reader — see that README) — the suite provisions the emulator script itself
  on every run.
- The spec flashes the full firmware image it built (erase + `write_flash 0x0`),
  so no firmware needs to be pre-loaded on the board. The `wlan0` AP comes from
  `firmware/tests/real_hardware/start-ap.sh` (SSID `PrismoTest`, `192.168.10.1`).
- The runner must reach GitHub over a link **other than `wlan0`** (e.g. Ethernet),
  since `wlan0` is turned into the AP.
- Install on the Pi: Node + `npm ci` in `web/`, `docker`, `mpremote`, `esptool`,
  `libgpiod` (`gpioget`), and NetworkManager (`nmcli`, passwordless `sudo`).

## Running

Full run (hotspot setup needs root, hence `sudo -E` to keep env):

```bash
cd web
sudo -E npm run teststand:run
```

Iterate on just the test against an already-running stack + hotspot:

```bash
cd web
TESTSTAND_MANAGE_HOTSPOT=false TESTSTAND_MANAGE_INFRA=false npm run teststand:test
```

## Configuration

All knobs live in `lib/env.ts`, overridable via env vars. Common ones:

| Env var                 | Default                              | Meaning                              |
| ----------------------- | ------------------------------------ | ------------------------------------ |
| `TESTSTAND_BASE_URL`    | `http://localhost:13000`             | Web app URL                          |
| `TESTSTAND_WIFI_SSID`   | `PrismoTest`                         | Hotspot SSID the device joins        |
| `TESTSTAND_WIFI_PASS`   | `prismotest123`                      | Hotspot password                     |
| `TESTSTAND_WIFI_IFACE`  | `wlan0`                              | Pi WiFi interface for the hotspot    |
| `TESTSTAND_MQTT_HOST`   | `192.168.10.1`                       | Broker IP as the _device_ reaches it |
| `TESTSTAND_SERIAL_PORT` | `/dev/ttyESP32C3`                    | ESP32-C3 serial port                 |
| `TESTSTAND_EMULATOR_PORT` | `/dev/ttyTagEmulator`              | PN532 tag-emulator serial port       |
| `TESTSTAND_EMULATE_SECONDS` | `10`                             | One tag-emulation window             |
| `TESTSTAND_GPIO_CHIP`   | `gpiochip4`                          | libgpiod chip for the success line   |
| `TESTSTAND_GPIO_LINE`   | `17`                                 | BCM line wired to the relay          |
| `SESSION_SECRET`        | `blackbox-secret-not-for-production` | Must match the running app           |
| `TESTSTAND_LOCAL_MQTT_URL` | `mqtt://localhost:1883`           | Broker as the _test host_ reaches it |
| `TESTSTAND_AP_PROFILE`  | `prismo-ap`                          | NetworkManager hotspot profile name  |
| `TESTSTAND_MQTT_CONTAINER` | `blackbox-e2e-mqtt-1`             | Broker container (broker-outage spec) |
| `TESTSTAND_OFFLINE_TIMEOUT_MS` | `30000`                       | Wait for the Offline badge after an outage |
| `TESTSTAND_RECONNECT_TIMEOUT_MS` | `120000`                    | Wait for Online after restoring AP/broker |
| `TESTSTAND_BOOT_OFFLINE_GRACE_MS` | `25000`                    | Boot-with-no-AP settling time        |

> The hotspot must be **2.4 GHz** — the ESP32-C3 has no 5 GHz radio. On
> dual-band adapters force the band if `nmcli` picks 5 GHz.

## Phase flags (for `teststand:run`)

| Flag                       | Default | Effect when `false`                |
| -------------------------- | ------- | ---------------------------------- |
| `TESTSTAND_MANAGE_HOTSPOT` | `true`  | Don't start/stop the hotspot       |
| `TESTSTAND_MANAGE_INFRA`   | `true`  | Don't start/stop docker compose    |
| `TESTSTAND_TEARDOWN`       | `true`  | Leave hotspot + stack up after run |
