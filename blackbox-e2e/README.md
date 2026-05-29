# Black-box end-to-end tests

This runs the application **as it runs in production** — the built web image from
`web/Dockerfile` (`node build`, `NODE_ENV=production`), not the `vite dev` server —
together with all of its infrastructure (Mongo replica set, Mosquitto, worker).

A black-box test then drives the running app from the outside (clicking buttons in
the browser, publishing MQTT messages as a device would) without touching the source.

## Production fidelity

| Concern        | Production (`docker-stack.yml`)        | Here                                  |
| -------------- | -------------------------------------- | ------------------------------------- |
| Web app        | image built from `web/Dockerfile`      | **same** image, built locally         |
| Mongo          | external replica set                   | `mongo:8` single-node replica set     |
| MQTT           | Mosquitto from `./mosquitto`           | **same** image                        |
| Worker         | `prismo-worker` image                  | **same** published image              |
| Google OAuth   | real Google                            | mocked via `TEST_MODE=1`              |

The only deliberate deviation is `TEST_MODE=1`, which swaps the real Google OAuth
client for the in-app mock (`web/src/lib/server/google-auth.ts`) so the test runner
can sign in without real Google credentials. The web artifact itself is unchanged.

## Usage

```bash
./blackbox-e2e/up.sh     # build + start, waits until the app is healthy
./blackbox-e2e/down.sh   # stop and wipe volumes
```

Once up:

- Web app → http://localhost:3000
- MongoDB → `mongodb://localhost:27017/prismo`
- MQTT    → `mqtt://admin:admin@localhost:1883`

Mongo and MQTT are published to the host so the test runner can reset the database
and publish device messages.
