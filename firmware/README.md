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

- `main.py`: Entry point.
- `wifi_manager.py`: Handles AP/Station switching and the Web Server.
- `PN532.py`: some AI generated code for works with PN532 board via SPI.
