# Prismo Firmware

ESP32 Firmware for Prismo project.

## Requirements

- ESP32 running MicroPython

## Usage

1. **First Boot**:
   - The device will start an Access Point named **Prismo-Setup**.
   - Connect to this network.
2. **Provisioning**:
   - A captive portal should open. If not, navigate to `http://prismo.local` or `http://192.168.4.1`.
   - Enter your home WiFi credentials.
3. **Run**:
   - The device will save credentials, reboot, and connect to your WiFi.
   - It will still be accessible via `http://prismo.local` on your network (if mDNS is supported by your router/client).

## Development

- `src/main.py`: Entry point.
- `src/wifi_manager.py`: Handles AP/Station switching and the Web Server.
- `libs/PN532.py`: some AI generated code for works with PN532 board via SPI.

## Building Firmware

This project is configured to automatically build a complete `firmware.bin` for ESP32-C3 using GitHub Actions. The build process compiles MicroPython and freezes all the `.py` files in `src/` and `libs/` directly into the binary to save RAM and improve startup time.

### How it works
- The `manifest.py` file in this directory tells the MicroPython compiler to freeze all Python code in `src/` and `libs/`.
- The `.github/workflows/build-and-deploy.yml` workflow automatically builds the firmware for the `ESP32_GENERIC_C3` board and utilizes the Docker image provided by Espressif.

### Verify the Build
1. Commit and push your changes to GitHub.
2. Go to the "Actions" tab in the GitHub repository.
3. Download the `prismo-firmware` artifact from the latest successful build.
4. Flash the resulting `firmware.bin` to your ESP32-C3 using:
   ```bash
   esptool.py --chip esp32c3 --port /dev/ttyACM0 write_flash -z 0x0 firmware.bin
   ```

## Flashing Instructions

Command to erase the flash on the board:
```bash
esptool --chip esp32c3 --port /dev/cu.usbmodem1401 erase_flash
```

Command to install MicroPython on Super Mini ESP:
```bash
esptool --baud 460800 write_flash 0 ESP32_GENERIC_C3-20251209-v1.27.0.bin
```
