## Local Development Setup

### Prerequisites

- **Node.js** 22+
- **Docker** (for the worker)
- **PostgreSQL** instance accessible from your machine

---

### 1. Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Minimum required variables:

```env
MONGODB_URL=mongodb://admin:admin@localhost:27017/prismo?authSource=admin
SESSION_SECRET=any-random-secret-string
GOOGLE_CLIENT_ID=your-google-client-id
```

---

### 2. Install dependencies and run migrations

```bash
npm install
npm run db:migrate
```

---

### 3. Start the SvelteKit dev server

```bash
npm run dev
```

App is available at `http://localhost:5173` with hot module replacement.

---

### 4. Start the worker (Docker with host file mounts)

The worker image is heavy (~several GB — it contains the full ESP-IDF and MicroPython toolchain). Pull the pre-built image from the registry and mount your local worker scripts over it so code changes are picked up instantly without rebuilding:

The worker reads `MONGODB_URL` from the environment. The easiest way to supply it is via the same `.env` file you already have:

```bash
docker run \
  --rm \
  --name prismo-worker-dev \
  --env-file .env \
  -v "$(pwd)/worker/worker.py:/worker/worker.py" \
  -v "$(pwd)/worker/build.sh:/worker/build.sh" \
  ghcr.io/nu31hackerspace/prismo-worker:latest
```

> **Note:** Make sure `MONGODB_URL` in `.env` uses `host.docker.internal` instead of `localhost` so the container can reach your host MongoDB. On Linux add `--add-host=host.docker.internal:host-gateway` if the hostname doesn't resolve automatically.

The mounts override only the Python script and build wrapper — the toolchain, pre-compiled firmware objects, and firmware source stay in the container as built.

To also mount firmware source (if you are actively changing MicroPython code and want incremental rebuilds from your local files):

```bash
docker run \
  --rm \
  --name prismo-worker-dev \
  --env-file .env \
  -v "$(pwd)/worker/worker.py:/worker/worker.py" \
  -v "$(pwd)/worker/build.sh:/worker/build.sh" \
  -v "$(pwd)/../firmware/src:/firmware/src" \
  ghcr.io/nu31hackerspace/prismo-worker:latest
```

> **Warning:** Mounting `firmware/src` means the worker will temporarily modify your host's `wifi_config.py` while a build job runs (it replaces the template placeholders, then restores them). Avoid editing that file while a job is in progress.

---

### 5. Trigger a test build

With both the web app and worker running, log in and go to `/flasher`. Enter any WiFi credentials and click **Build Firmware**. The worker will pick up the job, compile the firmware (~1–2 minutes with cached objects), and store the result. The UI polls every 5 seconds and switches to **Firmware ready** when done.

You can watch the worker logs in the terminal where Docker is running.

---

### Rebuilding the worker image locally

Only needed if you change the Dockerfile, toolchain versions, or want to test the full image build:

**Take a long time (~10 minutes) for first run**

```bash
# Run from the repo root
docker build -f web/worker/Dockerfile -t prismo-worker:local .
```

Then swap `ghcr.io/nu31hackerspace/prismo-worker:latest` with `prismo-worker:local` in the run command above.

## Run MQTT

Build docker image

```sh
docker build -f mosquitto/Dockerfile -t prismo-mqtt:local .
```

Run docker stack

```sh
docker stack deploy --resolve-image never -c docker-stack.local.yml prismo_local
```

In case you run docker in some VM envirment, like colima, use socar for port redirect

```
socat TCP-LISTEN:11883,fork,reuseaddr TCP:192.168.64.2:1883
```

---

## Running E2E Tests Locally

E2E tests use Playwright and require MongoDB (replica set) and Mosquitto MQTT broker.

### Using the CI compose file

The simplest way — spins up a fresh, isolated test environment:

```bash
# Start test infrastructure
docker compose -f docker-compose.ci.yml up -d --build --wait

# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Run tests
npx playwright test

# Tear down when done
docker compose -f docker-compose.ci.yml down -v
```

### Using the existing local stack

If you already have the local Docker stack running (`docker-stack.local.yml`), just run:

```bash
npx playwright test
```

The tests read `MONGODB_URL` and `MQTT_URL` from your `.env` file automatically.

### Viewing test reports

After a test run, open the HTML report:

```bash
npx playwright show-report
```

