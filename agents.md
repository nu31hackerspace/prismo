# agents.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prismo** is an open-source NFC/RFID access control system for hackerspaces. It runs MicroPython on an ESP32-C3 microcontroller and includes a SvelteKit web frontend for firmware flashing.

## Repository Structure

- `firmware/` — MicroPython code for ESP32-C3; compiled into a single `.bin` file
- `web/` — SvelteKit landing page + flasher UI (Web Serial API)
- `web-flasher/` — Docker container (Caddy) serving the compiled firmware binary and flasher HTML
- `hardware/` — KiCad PCB design, Gerber files, STEP models, 3MF enclosure files

## Common Commands

### Firmware

```bash
cd firmware

# Build firmware binary (~10-20 min first time; requires ESP-IDF toolchain)
./build.sh

# Flash to device (macOS example)
./flash.sh /dev/tty.usbmodem1101

# Regenerate frozen web assets after editing firmware/web/
python3 scripts/generate_frozen_assets.py

# Push live code changes to device without full rebuild
mpremote cp src/*.py :src/ + reset
mpremote cp src/frozen_assets.py :src/frozen_assets.py + reset
```

### Web (SvelteKit)

```bash
cd web
npm install
npm run dev          # Dev server at localhost:5173
npm run build        # Production build
npm run check        # TypeScript type-check
npm run lint         # Prettier check
npm run format       # Prettier format
```

### Web Flasher (Docker)

```bash
cd web-flasher
mkdir -p bin && cp ../firmware/dist/firmware.bin bin/
docker build -t prismo-web-flasher .
docker run -d -p 8080:80 prismo-web-flasher
```

## Architecture

### Firmware

All source files are **frozen into the binary** (no runtime filesystem needed). Build flow:

1. `scripts/generate_frozen_assets.py` converts `firmware/web/` HTML/CSS into `src/frozen_assets.py`
2. `build.sh` compiles everything via ESP-IDF + MicroPython into `dist/firmware.bin`

Boot sequence: `boot.py` → `src/prismo_boot.py` (WiFi AP setup, LED init) → `main.py` → `src/prismo_main.py` (orchestrates WiFi, NFC reader, web server, UI feedback)

Key modules:
- `src/prismo_main.py` — top-level orchestrator
- `src/web_server.py` — Microdot HTTP routes and embedded HTML templates
- `src/wifi_manager.py` — WiFi provisioning / connection
- `src/reader.py` + `src/reader_ui.py` — PN532 NFC reading + LED/buzzer feedback
- `src/config.py` — shared persistent configuration
- `libs/microdot.py` — embedded HTTP server library
- `libs/PN532.py` — NFC reader driver (SPI)

### Web Frontend

SvelteKit with Svelte 5, TypeScript, Tailwind CSS v4, and mdsvex.

Routes:
- `/` — Marketing landing page
- `/flasher` — Interactive firmware flashing via Web Serial API (Chrome/Edge/Opera only)

The flasher page uses `esptool-js` to talk to the ESP32 over Web Serial. It fetches the firmware binary from `/firmware/firmware.bin` (served by the Docker container) and streams it to the device.

### CI/CD

`.github/workflows/build-and-deploy.yml` runs on push:
1. Builds firmware binary using ESP-IDF
2. Packages it into the Docker image (`ghcr.io/nu31hackerspace/prismo-web-flasher:latest`)
3. On `main` branch: deploys via Docker Swarm over SSH

## Notes

- `firmware/src/frozen_assets.py` is auto-generated — do not edit manually
- The firmware is intentionally lean to fit the ~308 KB limit of the ESP32-C3 Super Mini
- The `web/AGENTS.md` file documents MCP tools available for the Svelte ecosystem (Svelte MCP server with `list-sections`, `get-documentation`, `svelte-autofixer`)
- **AI Rule:** Never add unnecessary or redundant comments to the code. Write clean, self-documenting code instead.
