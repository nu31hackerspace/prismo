# Prismo Web

This directory contains the SvelteKit web app and needed workers.

## Prerequisites

- Node.js 22+ and npm installed.
- Docker (or Colima) installed for containerised deployment.

### Quick Start (Local Development)

The easiest way to develop locally is to run the dev server directly with npm.

1. **Install dependencies**

```sh
npm install
```

2. **Start the development server**

```sh
npm run dev
```

3. **Other useful commands**

```sh
npm run check   # TypeScript type-check
npm run lint    # Prettier check
npm run format  # Prettier format
```

### Local Infrastructure (Database)

For backend features, you will need the local database running. We use a local Docker stack for this.

1. **Initialize Docker Swarm** (Required for the `overlay` network):

```sh
docker swarm init
```

_(If already initialized, you can skip this step.)_

2. **Deploy the Local Infrastructure**:

```sh
docker stack deploy -c docker-stack.local.yml prismo_local
```

3. **Database Configuration**:
   Before starting your local dev server, provide the database connection string and push the initially created schema:

```sh
export DATABASE_URL="postgresql://postgres:password@localhost:5432/prismo"
npm run db:push
npm run dev
```

_(You can also use `npm run db:studio` to view and manage data from Drizzle Studio)._

## Updating the Firmware Binary

The flasher serves the firmware from `static/firmware/firmware.bin`. To update it with a freshly built binary:

```sh
cp ../firmware/dist/firmware.bin static/firmware/firmware.bin
```

Then rebuild the app (or Docker image) so the new binary is picked up:

```sh
npm run build
# or for Docker:
docker build -t prismo-web .
```

> The firmware binary is built from the `firmware/` directory. See `firmware/README.md` for build instructions.

## Production Deployment

In CI/CD (GitHub Actions), the pipeline is already configured to build the Docker image and deploy it automatically on pushes to `main`.
