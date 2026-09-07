# Prismo Web

The SvelteKit app used to manage devices, register cards and flash boards from
the browser, plus the firmware build worker.

## Running it

From the repository root:

```bash
./dev.sh
```

Docker is the only prerequisite. This brings up the app, MongoDB, the MQTT
broker and a database viewer, and prints the URLs when everything is ready.
Full details — sign-in, port overrides, the device emulator, tests, the firmware
worker — are in [`DEVELOPMENT.md`](DEVELOPMENT.md).

## Layout

```
web/
├── src/routes/          # pages and API endpoints
├── src/lib/server/      # db access, auth, Google OAuth
├── src/lib/devices/     # device + MQTT logic
├── src/tests/e2e/       # Playwright specs
├── static/firmware/     # firmware.bin served by the flasher
└── worker/              # firmware build worker (Python + ESP-IDF image)
```

## Environment variables

| Variable               | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `MONGODB_URL`          | MongoDB connection string (replica set required)    |
| `MONGODB_DATABASE`     | Database name, defaults to `prismo`                 |
| `MQTT_URL`             | Broker URL including credentials                    |
| `SESSION_SECRET`       | Signing key for session JWTs                        |
| `ORIGIN`               | Public origin, used to build the OAuth redirect URI |
| `USERNAME`, `PASSWORD` | MQTT admin credentials the app manages devices with |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                              |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                          |
| `TEST_MODE`            | Replaces Google OAuth with a mock (dev/tests only)  |

`./dev.sh` sets all of these for you. `.env.example` covers running the app
outside Docker.

## Production deployment

GitHub Actions builds the Docker image and deploys it via Docker Swarm on every
push to `main` — see `.github/workflows/build-and-deploy.yml`.
