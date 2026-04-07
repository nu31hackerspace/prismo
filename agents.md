# agents.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Project Overview

**Prismo** is an open-source NFC/RFID access control system for hackerspaces. It runs MicroPython on an ESP32-C3 microcontroller and includes a SvelteKit web frontend for firmware flashing.

## Repository Structure

Each sub-project has its own `AGENTS.md` with detailed instructions:

- `firmware/` — MicroPython code for ESP32-C3; compiled into a single `.bin` file → [firmware/AGENTS.md](firmware/AGENTS.md)
- `web/` — SvelteKit landing page + flasher UI (Web Serial API) → [web/AGENTS.md](web/AGENTS.md)
- `hardware/` — KiCad PCB design, Gerber files, STEP models, 3MF enclosure files → [hardware/AGENTS.md](hardware/AGENTS.md)

## CI/CD

`.github/workflows/build-and-deploy.yml` runs on push:

1. Builds firmware binary using ESP-IDF
2. Packages it into the Docker image (`ghcr.io/nu31hackerspace/prismo-web-flasher:latest`)
3. On `main` branch: deploys via Docker Swarm over SSH

## Global Rules

- **AI Rule:** Never add unnecessary or redundant comments to the code. Write clean, self-documenting code instead.
