---
name: prismo-dev-setup
description: >-
  Use this skill to create and set up the local development environment for the developer. It starts Colima with a reachable IP, manages /etc/hosts for local domains, and spins up the Docker Compose stack.
---

# Prismo Development Environment Setup

This skill orchestrates the setup of the Prismo dev environment. You should perform the following steps carefully when a developer asks to set up the dev environment.

## 1. Start Colima VM
Start the Colima VM named `prismo-dev-vm` with a network address so it gets a dedicated reachable IP on the host machine.
Run:
`colima start prismo-dev-vm --network-address`

## 2. Obtain the VM IP Address
Retrieve the IP address assigned to the VM. You can find this by parsing the JSON output of:
`colima ls -j`

Find the object where `"name": "prismo-dev-vm"` and extract its `"address"` field.

## 3. Configure /etc/hosts
Ensure that the following domains map to the VM IP address (not 127.0.0.1) in `/etc/hosts`:
- `app.prismo.local.nu31.space`
- `mongo-viewer.prismo.local.nu31.space`
- `mqtt-viewer.prismo.local.nu31.space`
- `mqtt.prismo.local.nu31.space`

If the domains are missing or point to the wrong IP:
1. Show the user the required changes.
2. Ask the user for permission to execute a `sudo` command (e.g., using `sed` or `tee`) to update `/etc/hosts`, or ask them to run the command themselves.

## 4. Set Docker Context
Switch to the correct Docker context so that `docker compose` targets the VM:
`docker context use colima-prismo-dev-vm`

## 5. Start Docker Compose Stack
Start the services in detached mode with building enabled:
`docker compose -f docker-compose.dev.yml up -d --build`

Verify the services started correctly and notify the user that they can access the applications via HTTPS at the configured domains.

## 6. Helper Commands (MQTT and Emulator)
If the user asks to run the MQTT helper or emulator:
- **MQTT**: `docker compose -f docker-compose.dev.yml exec app node /mqtt/mqtt.js <args>`
- **Emulator**: `docker compose -f docker-compose.dev.yml exec -w /mqtt app npx tsx device-emulator.ts <args>`
- **Test**: `docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_BASE_URL=https://app.prismo.local.nu31.space app npx playwright test <args>`
