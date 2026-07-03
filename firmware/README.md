# Prismo Firmware

ESP32-C3 firmware for the Prismo NFC reader project.

## Usage

Most users never build the firmware by hand — the web flasher writes a pre-built
binary to the board over USB from the browser. See the **Quick start** in the
[root README](../README.md) for the end-to-end flow.

1. **Flash the device** using the web flasher (Chrome/Edge, via Web Serial).
2. **Done** — the device reboots, connects to your WiFi, and is ready to use.

The rest of this document covers building and flashing the firmware from source,
which you only need for firmware development.

## Project Structure

```
firmware/
├── boot.py            # Root entry-point (frozen into binary) → imports src/prismo_boot
├── main.py            # Root entry-point (frozen into binary) → imports src/prismo_main
├── manifest.py        # Tells MicroPython what to freeze into the binary
├── build.sh           # Builds the firmware
├── flash.sh           # Flashes the firmware to the board, the tty/cu. as argument
├── dist/              # Output binaries (created by build.sh)
├── src/               # Application code (frozen as src.* package)
└── libs/              # Third-party libraries (frozen as libs.* package)
```

## Connectivity

At boot the device tries WiFi then MQTT with bounded attempts and LED feedback
(`wifi_manager.connect()`, `mqtt.connect_now()`). Once the NFC reader loop is
running, connectivity is maintained from the loop's tick callback: WiFi loss
triggers asynchronous reassociation attempts (the ESP-IDF WiFi task does the
work in the background) and MQTT reconnects with capped exponential backoff,
resubscribing the command topics each time. Retries continue forever — the
NFC reader keeps scanning against the local allowlist throughout, and a single
tick is never blocked for more than a few seconds (bounded socket timeouts,
well under the watchdog).

`src/config.py` contains compile-time flags for development. Set them before flashing or running via `mpremote`.

| Flag          | Default | Description                                         |
| ------------- | ------- | --------------------------------------------------- |
| `DEBUG`       | `False` | Prints config on boot                               |
| `QUICK_START` | `False` | Skips boot animation and startup sounds             |
| `MUTE_BUZZER` | `False` | Silences all buzzer output (success & error sounds) |

**`MUTE_BUZZER`** is useful when iterating on firmware in a shared/quiet space — the board behaves identically (LED feedback, relay outputs, NFC reads) but produces no sound.

> **Important:** Keep `MUTE_BUZZER=False` for production/release builds. The CI pipeline and the `web-flasher` binary are always built with `MUTE_BUZZER=False` so end users get full audio feedback.

Example — enable silent mode for a dev session:

```python
# src/config.py
MUTE_BUZZER = True
```

Then push to the device:

```bash
mpremote cp src/config.py :src/config.py + reset
```

> **Never commit dev flags as `True`.** A pre-commit hook and a CI gate both enforce this. Activate the hook once after cloning:
>
> ```bash
> git config core.hooksPath .githooks
> ```

## Local Dev Credentials

`src/config.py` ships with `{{…}}` placeholder templates that the build worker replaces at CI time. For **local development**, create a `src/config_dev.py` file (already gitignored) to override them:

```python
# src/config_dev.py
WIFI_SSID = "MyNetwork"
WIFI_PASS = "MyPassword"
MQTT_HOST = "mqtt.example.com:8883"
MQTT_USER = "device_id"
MQTT_PASS = "device_secret"
MQTT_SSL  = "true"
```

Then push to the device:

```bash
mpremote cp src/config_dev.py :src/config_dev.py + reset
```

> **How it works:** `config.py` does `from src.config_dev import *` inside a `try/except ImportError`. When the file exists, its values override the `{{…}}` defaults. In production builds the file is absent, so the templates remain and the worker replaces them as usual.

---

## Development

Erase board

```bash
esptool --chip esp32c3 erase-flash
```

Flash micro python on esp32c3 board

```bash
esptool --baud 460800 write_flash 0 ESP32_GENERIC_C3-20251209-v1.27.0.bin
```

Create needed directory and upload the libraries

```bash
mpremote mkdir :libs
mpremote mkdir :src
mpremote cp libs/*.py :libs/
mpremote cp src/*.py :src/
mpremote cp main.py :main.py
mpremote cp boot.py :boot.py
```

Copy src and run the soft restart of

```bash
mpremote cp src/*.py :src/ + reset
```

Connect to device

```bash
mpremote connect <port>
```

For start the app run the following into mpremote process

```bash
import src.prismo_main
```

## Linting

Install [ruff](https://docs.astral.sh/ruff/) and run it from the `firmware/` directory:

```bash
pip install ruff
ruff check .
```

To auto-fix safe issues:

```bash
ruff check --fix .
```

The CI pipeline runs this check on every pull request that touches `firmware/`.

---
### Helpful commands

Show the connected usb devices (first column is a path to usb port)

```bash
mpremote devs
```

### Side notes

## Build & Flash (binary version)

### 1. Build the firmware

```bash
./build.sh
```

Produces binaries in `dist/`. Only needs to run once (or after code changes).

> **First build only** — will clone ESP-IDF and MicroPython (~1-2 GB, takes 10-20 min).
> Subsequent builds are fast (incremental).

### 2. Flash to the board

Connect your ESP32-C3 via USB, then:

```bash
./flash.sh /dev/tty.usbmodem1101   # macOS
./flash.sh /dev/ttyUSB0            # Linux
```

That's it. The script erases flash and writes the complete firmware. A manual reboot of the board is required afterwards.
