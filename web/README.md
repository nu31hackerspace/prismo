# Prismo Web

This directory contains the SvelteKit landing page and firmware flasher UI for Prismo. The flasher uses the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) to flash firmware directly from a browser.

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

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

3. **Other useful commands**

```sh
npm run check   # TypeScript type-check
npm run lint    # Prettier check
npm run format  # Prettier format
```

> **Note:** The `/flasher` route uses the Web Serial API, which requires a [Secure Context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). `localhost` qualifies as a secure context. If running on a remote machine, add the full origin (e.g. `http://<ip>:5173`) to `chrome://flags/#unsafely-treat-insecure-origin-as-secure` and restart the browser.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with:

```sh
npm run preview
```

### Docker

To build and run the production Docker image:

```sh
docker build -t prismo-web .
docker run -d -p 3000:3000 --name prismo-web prismo-web
```

Then open **http://localhost:3000**.

To stop the container:

```sh
docker rm -f prismo-web
```

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
