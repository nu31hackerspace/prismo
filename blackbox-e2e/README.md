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
GPIO 2 ─────────────────►│ IN                 │
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
| Success (coil)    | GPIO 2   | IN             | —                         |
| Power (coil)      | 3V3      | VCC            | —                         |
| Ground (coil)     | GND      | GND            | —                         |
| Success (contact) | —        | NO             | GPIO 17 — physical pin 11 |
| Contact return    | —        | COM            | 3.3V                      |

> **NC terminal** — leave unconnected.

#### How the signal works

```
Device fires SUCCESS
  → GPIO 2 goes HIGH
  → Relay coil energizes
  → NO contact closes (shorts Pi BCM 17 to GND)
  → Pi reads LOW  →  test detects "signal active"

Device ends signal
  → GPIO 2 goes LOW
  → Relay coil releases
  → NO contact opens
  → Pi internal pull-up restores HIGH  →  test detects "signal ended"
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
mpremote connect /dev/ttyESP32C3 exec "from machine import Pin; Pin(2, Pin.OUT).on()"
```

You should see the pin status change in first terminal:

```bash
mpremote connect /dev/ttyESP32C3 exec "from machine import Pin; Pin(2, Pin.OUT).off()"
```

---

### Setup the raspberry pi

#### Symlink the esp32 to ttyESP32C3 device

```sh
root@teststand:/etc/udev/rules.d# cat > /etc/udev/rules.d/99-esp32c3.rules <<'EOF'
> SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", ATTRS{idProduct}=="1001", SYMLINK+="ttyESP32C3", GROUP="dialout", MODE="0666"
EOF
root@teststand:/etc/udev/rules.d# cat 99-
99-esp32c3.rules       99-rpi-keyboard.rules
root@teststand:/etc/udev/rules.d# cat 99-
99-esp32c3.rules       99-rpi-keyboard.rules
root@teststand:/etc/udev/rules.d# cat 99-esp32c3.rules
SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", ATTRS{idProduct}=="1001", SYMLINK+="ttyESP32C3", GROUP="dialout", MODE="0666"
root@teststand:/etc/udev/rules.d# udevadm control --reload-rules
root@teststand:/etc/udev/rules.d# udevadm trigger --action=add --subsystem-match=tty
root@teststand:/etc/udev/rules.d# ls -la /dev/ttyESP32C3
lrwxrwxrwx 1 root root 7 May  7 19:04 /dev/ttyESP32C3 -> ttyACM0
root@teststand:/etc/udev/rules.d#
```

### Set pin pull down after reboot

`/boot/firmware`

file: `config.txt`

#### Runner lable

`test-stand`
