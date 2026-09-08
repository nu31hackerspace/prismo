## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, tailwindcss, mcp, sveltekit-adapter, mdsvex

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

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
- `generateMqttCredentials(page)` — clicks "Setup Device" and returns credentials
- `publishDeviceStatus(mqttUrl, credentials, online)` — sends a status heartbeat via MQTT
- Publishing custom MQTT payloads directly using `mqtt.connect` for scan/command events

### Helpers that are forbidden in tests

- `setDeviceModeInDb` — bypasses the UI, not black-box
- Any direct `MongoClient` usage in spec files
