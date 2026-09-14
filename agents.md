# agents.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Project Overview

**Prismo** is an open-source NFC/RFID access control system for hackerspaces. It runs MicroPython on an ESP32-C3 microcontroller and includes a React SPA for device management and firmware flashing, backed by a separate Express + socket.io API server.

## Repository Structure

Each sub-project has its own `AGENTS.md` with detailed instructions:

- `firmware/` — MicroPython code for ESP32-C3; compiled into a single `.bin` file → [firmware/AGENTS.md](firmware/AGENTS.md)
- `backend/` — Express API + socket.io realtime sync server (devices, keys, MQTT admin, Postgres).
- `client/` — React SPA (landing page, device management, flasher UI using the Web Serial API).
- `shared/` — TypeScript types shared between `backend/` and `client/`.
- `hardware/` — KiCad PCB design, Gerber files, STEP models, 3MF enclosure files 

## CI/CD

`.github/workflows/build-and-deploy.yml` runs on push:

1. Builds firmware binary using ESP-IDF
2. Packages it into the Docker image (`ghcr.io/nu31hackerspace/prismo-web-flasher:latest`)
3. On `main` branch: deploys via Docker Swarm over SSH

## Global Rules

- **Language Rule:** Write all code in this project (scripts, tools, frontend, etc.) in TypeScript. The only exception is the `firmware/` directory, which must use MicroPython to run on the ESP32-C3 microcontroller.
- **AI Rule:** Never add unnecessary or redundant comments to the code. Write clean, self-documenting code instead.
