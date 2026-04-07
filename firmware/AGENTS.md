# Firmware

MicroPython firmware for ESP32-C3. All source files are **frozen into the binary** (no runtime filesystem needed).

## Commands

```bash
# Build firmware binary (~10-20 min first time; requires ESP-IDF toolchain)
./build.sh

# Flash to device
./flash.sh /dev/tty.usbmodem1101   # macOS
./flash.sh /dev/ttyUSB0            # Linux

# Push live code changes to device without full rebuild
mpremote cp src/*.py :src/ + reset
```

## Build Flow

1. `build.sh` compiles everything via ESP-IDF + MicroPython into `dist/firmware.bin`

## Boot Sequence

`boot.py` → `src/prismo_boot.py` (LED start animation, buzzer check) → `main.py` → `src/prismo_main.py` (WiFi connection, MQTT, NFC reader loop)

## Key Modules

- `src/prismo_main.py` — top-level orchestrator
- `src/wifi_manager.py` — WiFi connection (uses callbacks for LED feedback)
- `src/mqtt_client.py` — MQTT client with robust reconnection and backoff
- `src/reader.py` + `src/reader_ui.py` — PN532 NFC reading + LED/buzzer feedback
- `src/config.py` — device configuration with `{{…}}` templates for production, overridden by `config_dev.py` for local dev
- `src/color.py` — RGB LED control and animations (start, WiFi pulse, MQTT pulse)
- `src/buzzer.py` — buzzer control
- `src/health_log.py` — structured logging with optional MQTT publishing
- `libs/PN532.py` — NFC reader driver (SPI)

## Notes

- The firmware is intentionally lean to fit the ~308 KB limit of the ESP32-C3 Super Mini
- `src/config_dev.py` is gitignored — used for local WiFi/MQTT credentials
- **AI Rule:** Never add unnecessary or redundant comments to the code. Write clean, self-documenting code instead.
