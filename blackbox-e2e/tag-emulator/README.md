# tag-emulator

Minimal standalone firmware that turns a PN532 into a **passive ISO14443-A tag
emulator**.

On the test stand this powers the real-NFC phases of the hardware e2e: the
suite provisions this firmware onto the second ESP32-C3 (`/dev/ttyTagEmulator`)
on every run and drives it over serial — see
`../tests/teststand/lib/tag-emulator.ts`. The `cli/` subfolder is a standalone
manual debugging tool; the suite does not use it.

> **Do not persist `main.py` as the board's boot script** — its stdin-reader
> thread breaks mpremote's raw REPL and locks you out (recover with
> `esptool erase_flash`). The e2e provisioning runs it without saving.

## Is tag emulation possible with the PN532?

Yes, partially. Limitations to be aware of:

- It emulates the **anticollision + UID** layer only. It does **not** fully
  emulate a MiFare Classic with authenticated/readable sectors.
- In target mode the NFCID1 is 3 bytes. The reader sees a **4-byte UID**:
  `0x08` (the "random UID" cascade tag) followed by your 3 bytes. So with an
  emulated UID of `12 34 56`, a reader reports `08123456`.

## Files

- `PN532.py` — SPI driver (copied from `firmware/libs/PN532.py`, plus a
  `tg_init_as_target()` method added for emulation).
- `main.py` — initializes SPI + PN532 and loops in target mode.

## Wiring (Prismo pin map)

| PN532 | ESP32-C3 GPIO |
| ----- | ------------- |
| SCK   | 1             |
| MISO  | 2             |
| MOSI  | 3             |
| SS    | 4             |

## How it works

When the script runs, it operates in two phases:

1. **Waiting for Input**: On startup, it does not emulate anything. It waits indefinitely for your input.
2. **Custom Emulation**: You connect via a serial terminal and send a 6-character hex string. It will immediately begin emulating your custom UID. You can send new keys at any time to update it on the fly.

## Connecting to the Serial Terminal

To interact with the device and send your custom hex key, you need a serial monitor. Unlike Arduino IDE, MicroPython runs natively, but you can use any standard serial terminal.

**Option 1: Using `miniterm` (Recommended)**
If you have Python installed:

```sh
python -m serial.tools.miniterm /dev/tty.usbmodem1101 115200
```

_(Press `Ctrl+]` to exit miniterm)_

**Option 2: Using `screen` (Built-in on Mac/Linux)**

```sh
screen /dev/tty.usbmodem1101 115200
```

_(Press `Ctrl+A` then `K` to kill screen)_

**Option 3: Using `mpremote repl`**
If the script is saved as `main.py` on the device and running automatically:

```sh
mpremote connect /dev/tty.usbmodem1101 repl
```

## Run

```sh
mpremote connect <PORT> cp PN532.py : + cp main.py : + run main.py
```
