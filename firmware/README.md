# Prismo Firmware

ESP32-C3 firmware for the Prismo NFC reader project. 

## Usage

1. **Flash the device ** Flash device the web flasher 
2. **Done** — The device reboots, connects to your WiFi, and ready to user

## Project Structure

```
firmware/
├── boot.py            # Root entry-point (frozen into binary) → imports src/prismo_boot
├── main.py            # Root entry-point (frozen into binary) → imports src/prismo_main
├── manifest.py        # Tells MicroPython what to freeze into the binary
├── build.sh           # Builds the firmware
├── flash.sh           # Flashes the firmware to the board
├── dist/              # Output binaries (created by build.sh)
├── src/               # Application code (frozen as src.* package)
│   ├── prismo_boot.py # Boot sequence (WiFi setup, LED check)
│   ├── prismo_main.py # Main loop (NFC reader, web server)
│   ├── config.py      # Device configuration
│   ├── wifi_manager.py
│   ├── reader.py
│   ├── reader_ui.py
│   ├── color.py
│   ├── buzzer.py
└── libs/              # Third-party libraries (frozen as libs.* package)
    ├── PN532.py       # NFC reader driver (SPI)
    └── microdot.py    # Lightweight HTTP server
```

## Developer Feature Flags

`src/config.py` contains compile-time flags for development. Set them before flashing or running via `mpremote`.

| Flag | Default | Description |
|------|---------|-------------|
| `DEBUG` | `False` | Prints config on boot |
| `QUICK_START` | `False` | Skips boot animation and startup sounds |
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
> ```bash
> git config core.hooksPath .githooks
> ```

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
./flash.sh
```

That's it. The script erases flash and writes the complete firmware. The board auto-reboots — **Prismo-Setup** WiFi AP should appear within a few seconds.

> If the board doesn't reboot automatically after flashing, unplug and replug the USB cable once.

#### Custom port

```bash
./flash.sh /dev/tty.usbmodem1101   # macOS
./flash.sh /dev/ttyUSB0            # Linux
```

## How It Works

All Python code is **frozen** (compiled and embedded directly) into `micropython.bin` at build time:

- `boot` and `main` modules → MicroPython finds them automatically on startup (no filesystem needed)
- `src.*` and `libs.*` packages → imported by boot/main

This means zero RAM is used for module storage and startup is instant.
