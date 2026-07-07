## The test stand for the prismo project.

---

### Relay wiring — GPIO isolation for hardware tests

The test stand uses a relay module to read the Prismo device's success/error
output pins without sharing ground with the ESP32-C3. The relay provides full
galvanic isolation: a fault on the device cannot reach the Pi GPIO header.

This section covers the **success channel** (one relay).

#### Wire diagram

```
ESP32-C3                 Relay module                  Raspberry Pi
────────────             ──────────────────────        ──────────────────────
USB ─────────────────►   usb cable (power)     ───────► USB port mount /dev/ttyesp32c
                         ┌────────────────────┐
GPIO 5 ─────────────────►│ IN                 │
3V3    ─────────────────►│ VCC    .           │        ╔══════════════════╗
GND    ─────────────────►│ GND                │        ║  Pi GPIO header  ║
                         │                    │        ║                  ║
                         │                NO ─╫────────╫► PIN 11, GPIO17  ║
                         │               COM ─╫────────╫► 3.3V            ║
                         │                NC  │  open  ║                  ║
                         └────────────────────┘        ╚══════════════════╝

```

ESP32-C3 GND and Pi GND are NOT connected — this is the isolation gap.

#### Pin reference

| Signal            | ESP32-C3 | Relay terminal | Raspberry Pi              |
| ----------------- | -------- | -------------- | ------------------------- |
| Success (coil)    | GPIO 5   | IN             | —                         |
| Power (coil)      | 3V3      | VCC            | —                         |
| Ground (coil)     | GND      | GND            | —                         |
| Success (contact) | —        | NO             | GPIO 17 — physical pin 11 |
| Contact return    | —        | COM            | 3.3V                      |

> **NC terminal** — leave unconnected.

#### How the signal works

```
Device fires SUCCESS
  → GPIO 5 goes HIGH
  → Relay coil energizes
  → NO contact closes (ties Pi BCM 17 to 3.3V)
  → Pi reads HIGH  →  test detects "signal active"

Device ends signal
  → GPIO 5 goes LOW
  → Relay coil releases
  → NO contact opens
  → Pi pull-down restores LOW  →  test detects "signal ended"
```

#### Verify the wiring before running tests

SSH to PI in two terminal windows

Run in first ssh session:

```bash
while true; do   echo "$(date +%T.%3N) $(gpioget -c gpiochip4 17)";   sleep 1; done
```

The command will print the statu of the PI GPIO pin each second

Run in second ssh session:

```bash
mpremote connect /dev/ttyESP32C3 exec "from machine import Pin; Pin(5, Pin.OUT).on()"
```

You should see the pin status change in first terminal:

```bash
mpremote connect /dev/ttyESP32C3 exec "from machine import Pin; Pin(5, Pin.OUT).off()"
```

---

### Setup the raspberry pi

#### Symlink the two ESP32-C3 boards to stable device names

The stand carries **two** ESP32-C3 boards — the Prismo device under test and
the PN532 tag emulator (`tag-emulator/`). Both enumerate with the same USB
VID:PID (`303a:1001`), so a rule matching only VID:PID races: whichever board
enumerates last steals the symlink. Match each board's USB serial (its MAC)
instead. Find the serials with:

```sh
ls /dev/serial/by-id/
# usb-Espressif_USB_JTAG_serial_debug_unit_10:B4:1D:1C:87:DC-if00 -> ../../ttyACM0
# usb-Espressif_USB_JTAG_serial_debug_unit_70:AF:09:3B:0C:74-if00 -> ../../ttyACM1
```

```sh
cat > /etc/udev/rules.d/99-esp32c3.rules <<'EOF'
# Prismo test stand: two ESP32-C3 boards, distinguished by USB serial (MAC).
# DUT (device under test) — the Prismo reader the suite flashes:
SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", ATTRS{idProduct}=="1001", ATTRS{serial}=="10:B4:1D:1C:87:DC", SYMLINK+="ttyESP32C3", GROUP="dialout", MODE="0666"
# PN532 tag emulator (blackbox-e2e/tag-emulator):
SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", ATTRS{idProduct}=="1001", ATTRS{serial}=="70:AF:09:3B:0C:74", SYMLINK+="ttyTagEmulator", GROUP="dialout", MODE="0666"
EOF
udevadm control --reload
udevadm trigger --subsystem-match=tty
ls -l /dev/ttyESP32C3 /dev/ttyTagEmulator
```

#### Tag emulator board — one-time preparation

The emulator board must run **stock MicroPython** with an empty filesystem —
the suite provisions the emulator script fresh on every run (see
`tests/teststand/lib/tag-emulator.ts`). If the board previously ran Prismo (or
any) firmware, wipe it:

```sh
curl -sO https://micropython.org/resources/firmware/ESP32_GENERIC_C3-20251209-v1.27.0.bin
esptool --chip esp32c3 --port /dev/ttyTagEmulator erase_flash
esptool --chip esp32c3 --port /dev/ttyTagEmulator --baud 460800 write_flash 0x0 ESP32_GENERIC_C3-20251209-v1.27.0.bin
```

Do **not** persist `tag-emulator/main.py` as the board's boot script: it spawns
a stdin-reader thread that breaks mpremote's raw REPL, locking yourself out of
the board (recover with `esptool erase_flash`).

Physical setup: the emulator's PN532 antenna must sit within RF coupling range
(~1–3 cm) of the reader's PN532 antenna.

### Set pin pull down after reboot

`/boot/firmware`

file: `config.txt`

#### Runner lable

`test-stand`
