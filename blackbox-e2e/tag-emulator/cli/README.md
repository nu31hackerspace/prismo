# Tag Emulator CLI

A simple TypeScript CLI to control the PN532 tag emulator. It allows you to specify a hex key and a time duration. The CLI will connect to the device, send the key, wait for the specified duration, and then tell the device to stop emulating.

## Setup

1. Make sure you have Node.js installed.
2. Run `npm install`
3. Run `npm run build`

## Usage

```sh
node dist/index.js --port <port> --key <hex_string> --time <seconds>
```

**Options:**
- `-p, --port <port>`: The serial port of your ESP32-C3 (e.g. `/dev/tty.usbmodem1101` on Mac, or `/dev/ttyACM0` on Linux/Raspberry Pi)
- `-k, --key <hex>`: The 6-character hex string of the NFC tag to emulate (e.g., `aabbcc`)
- `-t, --time <seconds>`: How long to emulate the tag before stopping

**Example:**
```sh
node dist/index.js -p /dev/tty.usbmodem1101 -k 123456 -t 10
```

This is designed to run perfectly on a Raspberry Pi 5 or any Linux system where Node.js is installed.
