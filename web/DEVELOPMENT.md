# Development

## Quick start

You need **Docker** and nothing else — no local Node.js, MongoDB or Mosquitto.
Run from the repository root:

```bash
./dev.sh
```

That starts the web app, MongoDB (as a single-node replica set), a Mosquitto
broker and a database viewer, waits until the app is actually serving, prints
the URLs and then follows the app logs. Ctrl+C detaches; the stack keeps
running.

| Service        | URL                   | Credentials   |
| -------------- | --------------------- | ------------- |
| Web app        | http://localhost:3000 | see below     |
| MongoDB viewer | http://localhost:5000 | admin / admin |
| MongoDB        | localhost:27017       | no auth       |
| MQTT broker    | mqtt://localhost:1883 | admin / admin |

### Signing in

Click **Sign in with Google**. Locally the stack runs with `TEST_MODE=1`, which
swaps the Google OAuth client for a mock — you are logged straight in as a test
user and **no Google credentials are needed**.

To exercise the real Google flow instead, put this in the root `.env`:

```env
DEV_MOCK_LOGIN=
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Port already in use

If something on your machine already owns 3000 / 27017 / 1883 / 5000, `./dev.sh`
says so before starting anything. Copy `.env.example` to `.env` in the repository
root and change the ports:

```env
WEB_PORT=3100
MONGO_PORT=27117
MQTT_PORT=1983
MONGO_VIEWER_PORT=5100
```

## Commands

All of these are run from the repository root.

```bash
./dev.sh                 # start everything, follow app logs
./dev.sh --help          # full command list
./dev.sh down            # stop, keep data
./dev.sh reset           # stop and wipe the database / broker state
./dev.sh logs [service]  # follow logs (default: app)
./dev.sh ps              # service status
./dev.sh shell           # bash inside the app container
./dev.sh test            # run the Playwright E2E suite
```

### Live editing

- **Web app** — `web/` is mounted into the `app` container, so any change to a
  `.svelte` or `.ts` file triggers Vite HMR immediately.
- **Worker** — `worker/worker.py` and `worker/build.sh` are mounted read-only
  into the worker container and picked up on the next job cycle.

## Working without hardware

`./dev.sh emulator` publishes device→server MQTT messages exactly as a real
Prismo board would, so you can develop device features without a board on the
desk. The available messages and their fields come from
[`mqtt-contract/contract.json`](../mqtt-contract/contract.json):

```bash
./dev.sh emulator --help

# A card was tapped and accepted
./dev.sh emulator scan my-device --uid=DEADBEEF --allowed=true

# Heartbeat
./dev.sh emulator status my-device --online=true --uptime-s=120
```

Use `./dev.sh mqtt` to watch or inject raw traffic:

```bash
./dev.sh mqtt --mode=read  --topic='#'
./dev.sh mqtt --mode=write --topic='prismo/test' --message='hello'
```

## Firmware build worker

The `/flasher` page hands firmware builds to a worker container. Its image
carries the full ESP-IDF and MicroPython toolchain (several GB), so it is **not**
started by default. Add it only when you work on firmware builds:

```bash
./dev.sh up --with-worker
```

Then log in, open `/flasher`, enter any WiFi credentials and click **Build
Firmware**. The worker picks the job up and compiles (~1–2 minutes with cached
objects); the UI polls and switches to **Firmware ready** when it is done.
Watch it with `./dev.sh logs worker`.

To iterate on the MicroPython sources themselves, also mount them into the
worker by adding to `docker-compose.dev.yml`:

```yaml
- ./firmware/src:/firmware/src
```

> **Warning:** the worker temporarily rewrites `wifi_config.py` while a build
> runs (it substitutes the template placeholders, then restores them). Do not
> edit that file while a job is in progress.

Rebuilding the worker image locally is only needed if you change its Dockerfile
or toolchain versions (~10 minutes on the first run):

```bash
docker build -f web/worker/Dockerfile -t prismo-worker:local .
```

Then point the `worker` service at `prismo-worker:local`.

## E2E tests

```bash
./dev.sh test                            # whole suite
./dev.sh test --grep device              # a subset
./dev.sh test --grep-invert firmware     # skip the firmware build spec
```

The first run installs Chromium inside the app container; it is cached in a
Docker volume afterwards. Reports land in `web/playwright-report/` — open them
with `npx playwright show-report` from `web/`.

One spec (`firmware-download.spec.ts`) drives a real firmware build, so it needs
the worker: run the stack with `./dev.sh up --with-worker` first, or skip that
spec with `--grep-invert firmware`. `./dev.sh test` reminds you when the worker
is not up.

CI runs the same suite against `docker-compose.ci.yml`, which is the same
infrastructure minus the app container (CI runs the app on the runner itself).

## Running the app outside Docker

Only needed if you want a debugger attached to the SvelteKit process or you
prefer your host's Node. Start the infrastructure, then run the app on the host:

```bash
./dev.sh up --no-logs
cd web
cp .env.example .env      # then fill in MONGODB_URL / MQTT_URL for localhost
npm install
npm run dev
```

Other useful scripts in `web/`:

```bash
npm run check    # svelte-check / TypeScript
npm run lint     # Prettier check
npm run format   # Prettier write
```

## Updating the flasher's firmware binary

The flasher serves `web/static/firmware/firmware.bin`. To ship a freshly built
binary:

```bash
cp firmware/dist/firmware.bin web/static/firmware/firmware.bin
```

See [`firmware/README.md`](../firmware/README.md) for how to build it.
