# Prismo Firmware

ESP32-C3 firmware for the Prismo NFC reader project. Built on MicroPython with all application code **frozen into the binary** — no files need to be uploaded separately after flashing.

## Usage

1. **First Boot** — The device starts a WiFi Access Point named **00_prismo**
2. **Provisioning** — Connect to the network **00_prismo**. Open the web page with address `http://prismo.local`.
3. **Enter your WiFi credentials and configuration** and save
4. **Done** — The device reboots, connects to your WiFi, and is accessible at `http://prismo.local`

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
│   ├── web_server.py
│   ├── reader.py
│   ├── reader_ui.py
│   ├── color.py
│   ├── buzzer.py
│   ├── dns_server.py
│   └── mdns_server.py
└── libs/              # Third-party libraries (frozen as libs.* package)
    ├── PN532.py       # NFC reader driver (SPI)
    └── microdot.py    # Lightweight HTTP server
```

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
mpremote cp boot.py :boot.py
mpremote cp main.py :main.py
mpremote cp libs/* :libs/
mpremote cp src/* :src/
```

Copy src and run the soft restart of
```bash
mpremote cp src/* :src/ + reset
```

Connect to device
```bash
mpremote connect <port>
```

### Helpful commands 

Show the connected usb devices (first column is a path to usb port)
```bash
mpremote devs
```

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
