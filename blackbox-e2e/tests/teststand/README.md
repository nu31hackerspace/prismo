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
│        │ GPIO 2 (success)                                                  │
│        ▼                                                                   │
│   relay (isolated) ──► Pi BCM 17 ◄── gpioget reads here                    │
└───────────────────────────────────────────────────────────────────────────┘
```

## What it does

1. **Seed auth** — inserts a user + session into Mongo and mints the session
   cookie (the _only_ black-box exception, to skip Google OAuth). See
   `lib/seed-auth.ts`.
2. **Create device** through the UI and **Generate Token** (real MQTT creds).
3. **Provision the device** (`lib/flash.ts`) — writes `src/config_dev.py` with
   this run's WiFi + MQTT credentials over `mpremote` and soft-resets the board.
4. Assert the UI shows **Online** (driven by real MQTT heartbeats).
5. Click **Trigger Success** → MQTT `cmd/trigger` → firmware drives GPIO 2 HIGH →
   relay closes → Pi reads the line active (`lib/gpio.ts`).

## One-time stand setup

- Wire the relay per [`test-stand/README.md`](../../README.md).
- Create the `/dev/ttyESP32C3` udev symlink (see that README).
- Put the **Prismo app on the device**. CI does this each run by reusing
  `firmware/tests/real_hardware/run_tests.sh` (flash stock MicroPython + upload
  source); per-run provisioning then only injects `src/config_dev.py` and
  soft-resets. The `connectivity` and `wlan0` AP come from
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
| `TESTSTAND_GPIO_CHIP`   | `gpiochip4`                          | libgpiod chip for the success line   |
| `TESTSTAND_GPIO_LINE`   | `17`                                 | BCM line wired to the relay          |
| `SESSION_SECRET`        | `blackbox-secret-not-for-production` | Must match the running app           |

> The hotspot must be **2.4 GHz** — the ESP32-C3 has no 5 GHz radio. On
> dual-band adapters force the band if `nmcli` picks 5 GHz.

## Phase flags (for `teststand:run`)

| Flag                       | Default | Effect when `false`                |
| -------------------------- | ------- | ---------------------------------- |
| `TESTSTAND_MANAGE_HOTSPOT` | `true`  | Don't start/stop the hotspot       |
| `TESTSTAND_MANAGE_INFRA`   | `true`  | Don't start/stop docker compose    |
| `TESTSTAND_TEARDOWN`       | `true`  | Leave hotspot + stack up after run |
