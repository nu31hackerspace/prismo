# Prismo Web Flasher

This directory contains the web interface used to flash the generated Prismo firmware directly from a web browser using the [ESP Web Tools](https://esphome.github.io/esp-web-tools/) library.

## Prerequisites
- Docker (or Colima) installed on your machine.
- Your built `firmware.bin` file available in the `bin/` directory.

### Quick Start (Local Development)

The easiest way to test this locally is to use the Docker container which serves the website and the firmware using Caddy on port 80.

1. **Copy the latest firmware binary**
   Before building the docker image, you must ensure the actual compiled `.bin` file is copied securely inside the `bin` directory (symlinks to the firmware folder will not work inside Docker).

```bash
cd web-flasher
mkdir -p bin
cp ../firmware/dist/firmware.bin bin/
```

2. **Build the Docker Image**
```bash
docker build -t prismo-web-flasher .
```

3. **Run the Docker Container**
We will expose the internal port 80 to port 8080 on your host.
```bash
docker rm -f web-flasher || true
docker run -d -p 8080:80 --name web-flasher prismo-web-flasher
```

4. **Access the Flasher**

Open your browser and navigate to:

- **http://localhost:8080** (Recommended: Browser strictly limits Web Serial to "Secure Contexts", but localhost is an exception).

In case you run the flasher on a remote machine, and you want to access it via `http://<remote-machine-ip>:8080`. You must add your host into chrome secure excption list here -> chrome://flags/#unsafely-treat-insecure-origin-as-secure and restart the browser. Add the full host with the schema and port

5. **Stop the Container**
```bash
docker rm -f web-flasher
```

## Production Deployment
In CI/CD (GitHub Actions), the pipeline is already configured to seamlessly build the `firmware.bin`, copy it to this `bin/` folder, and automatically execute the Docker build step to create a deployable artifact containing exactly that build.
