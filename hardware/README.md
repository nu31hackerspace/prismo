# Hardware

KiCad PCB design, STEP 3D models, and 3MF enclosure files for the Prismo NFC reader.

## Contents

- `kikad/` — KiCad project files (schematic + PCB layout)
- `body/` — 3D-printable enclosure files (3MF)
- `relay/` — Relay module design
- `*.step` — 3D assembly models for the ESP32-C3 Super Mini, PN532 NFC module, LED PCB, and full assembly

## Notes

- Hardware design changes generally do not affect firmware or web — they are independent.
- When referencing pin assignments, the source of truth is `firmware/src/config.py` (the `PIN_*` constants).
