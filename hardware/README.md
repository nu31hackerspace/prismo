# Hardware

KiCad PCB design, STEP 3D models, and 3MF enclosure files for the Prismo NFC reader.

## Contents

- `kikad/` — KiCad project files (schematic + PCB layout)
- `body/` — 3D-printable enclosure files (3MF)
- `relay/` — Relay module design
- `*.step` — 3D assembly models for the ESP32-C3 Super Mini, PN532 NFC module, LED PCB, and full assembly

## BOM file

[Prismo BOM](https://docs.google.com/spreadsheets/d/12qys1HxDHsoDdR1gj1rnD1MEdx9XqdHl3aNJ3M6xwPU/edit?usp=sharing)

## 3d models and printed parts

All parts, model in OnShape. You can export all geometry in prefer format (SLT, STEP, ...).

[Link to OnShape project](https://cad.onshape.com/documents/9ae3614c203d1c98be9965f1/w/a32dcbcd16349b1911a14bed/e/3677841647a1055dd73aa894?renderMode=0&uiState=6a2e7c1e45387cb9ce12cedf)

The step file of PCB with PN532 cloud be download directly from github file: led_pcb.step

## Printer settings

For print the main box, use 100% infill and PETG or PLA filament.
For print the light pannel use the 20% infill and transparent PETG or PLA filament.

__The transparent filament needed only for cool light effect, the 3d printed part didn't affect the device.__

## Notes

- Hardware design changes generally do not affect firmware or web — they are independent.
- When referencing pin assignments, the source of truth is `firmware/src/config.py` (the `PIN_*` constants).

