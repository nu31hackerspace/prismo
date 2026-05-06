# Prismo Web — Claude Code Guidelines

## E2E Testing Rules

**E2E tests must be fully black-box — no direct database access.**

- Do NOT call `setDeviceModeInDb`, `MongoClient`, or any DB helpers from test files.
- All test state must be set up through the UI or MQTT messages, exactly as a real user or device would.
- To create a device in machine mode, pass `mode: 'machine'` to the `createDevice` UI helper — the form sends it to the server.
- To emulate device commands (scan, status, machine state), publish MQTT messages using the device's credentials obtained via `generateMqttCredentials`.
- Never reach into the database to verify state — assert only through what the UI shows.

### Helpers that are allowed
- `loginUser(page)` — signs in via the UI
- `createDevice(page, name, mode?)` — creates a device through the form (default mode: `'door'`)
- `navigateToDevice(page, name)` — clicks through to the device management page
- `generateMqttCredentials(page)` — clicks "Generate Token" and returns credentials
- `publishDeviceStatus(mqttUrl, credentials, online)` — sends a status heartbeat via MQTT
- Publishing custom MQTT payloads directly using `mqtt.connect` for scan/command events

### Helpers that are forbidden in tests
- `setDeviceModeInDb` — bypasses the UI, not black-box
- Any direct `MongoClient` usage in spec files
