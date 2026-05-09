#!/usr/bin/env python3
"""
Pi-side GPIO verifier for Prismo hardware test.

Starts test_gpio_real.py on the ESP32-C3 via mpremote (emulates a PN532 card
scan), then polls GPIO 17 on the Pi 5 and verifies it goes active and holds
for ~5 seconds.

  relay closed (device HIGH) → pin pulled to GND → gpioget returns 0 → active
  relay open   (device LOW)  → pin pulled HIGH   → gpioget returns 1 → inactive

Verify wiring before running:
  gpioget -c gpiochip4 17

Requires: gpiod    (sudo apt install gpiod)
          mpremote (pip install mpremote)

Wiring:
  ESP32-C3 GPIO 2 → Relay-1 IN   Relay-1 NO → Pi BCM 17 (pin 11)
  ESP32-C3 3V3    → Relay-1 VCC
  ESP32-C3 GND    → Relay-1 GND (coil side)
  Pi GND (pin 9)  → Relay-1 COM (contact side)
"""

import os
import subprocess
import sys
import time

_SUCCESS_PIN      = 17
_TEST_UID         = "test_card_uid"
_POLL_S           = 0.1    # 10 ms between gpioget calls
_WAIT_ACTIVE_S    = 15     # timeout waiting for pin to go active
_EXPECTED_MS      = 5000   # firmware SUCCESS_SIGNAL_DURATION
_TOLERANCE_MS     = 500    # allowed undershoot
_WAIT_INACTIVE_S  = 10     # timeout waiting for pin to go inactive after hold


def _log(msg="", **kwargs):
    ts = time.strftime("%H:%M:%S") + f".{int(time.time() * 1000) % 1000:03d}"
    print(f"[{ts}] {msg}", **kwargs)


def _read_pin(pin: int) -> int | None:
    r = subprocess.run(
        ["gpioget", "-c", "gpiochip4", str(pin)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        _log(f"ERROR: gpioget failed (rc={r.returncode}): {r.stderr.strip()}")
        sys.exit(1)

    output = r.stdout.strip()

    # libgpiod v2 format: '"17"=active' or '"17"=inactive'
    # active = pin HIGH (relay open), inactive = pin LOW (relay closed = device asserting)
    if "=inactive" in output:
        return 0
    if "=active" in output:
        return 1
    # libgpiod v1 format: plain '0' or '1'
    try:
        return int(output)
    except ValueError:
        _log(f"ERROR: unexpected gpioget output: {output!r}")
        sys.exit(1)


def _wait_for(pin: int, target: int, timeout_s: float) -> bool:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if _read_pin(pin) == target:
            return True
        time.sleep(_POLL_S)
    return False


def main():
    port = os.environ.get("ESP32_PORT") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not port:
        _log("ERROR: No port. Set ESP32_PORT or pass as argument.")
        sys.exit(1)

    _log("Start board and wait for 3 seconds")
    time.sleep(3)

    firmware_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # mpremote run does not support passing arguments, and MicroPython's sys
    # has no argv in an exec context, so inject key_uid as a plain variable.
    setup_exec = (
        f"key_uid = '{_TEST_UID}'; "
        f"exec(open('tests/real_hardware/add_key_for_success_pull.py').read())"
    )
    _log(f"Running device setup (registering UID '{_TEST_UID}')...")
    setup = subprocess.run(
        ["mpremote", "connect", port, "mount", firmware_dir, "exec", setup_exec],
        capture_output=True, text=True,
    )
    if setup.returncode != 0:
        _log("FAIL: Setup script failed")
        for line in (setup.stdout + setup.stderr).splitlines():
            _log(f"  [device] {line}")
        sys.exit(1)
    _log("Setup complete. Waiting 3 seconds before triggering...")
    time.sleep(3)

    trigger_exec = (
        f"key_uid = '{_TEST_UID}'; "
        f"exec(open('tests/real_hardware/send_rfid_key_scan.py').read())"
    )
    _log(f"Triggering card scan with UID '{_TEST_UID}'...")
    device = subprocess.Popen(
        ["mpremote", "connect", port, "mount", firmware_dir, "exec", trigger_exec],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )

    # Stage 1 — wait for pin to go active
    _log(f"Waiting for GPIO {_SUCCESS_PIN} to go active (up to {_WAIT_ACTIVE_S} s)...")
    if not _wait_for(_SUCCESS_PIN, 0, _WAIT_ACTIVE_S):
        for line in device.stdout:
            _log(f"  [device] {line}", end="")
        device.wait()
        _log(f"FAIL: GPIO {_SUCCESS_PIN} never went active")
        sys.exit(1)

    active_at = time.monotonic()
    _log(f"  GPIO {_SUCCESS_PIN} active")

    # Stage 2 — verify it stays active for (EXPECTED - TOLERANCE) ms
    min_hold_s = (_EXPECTED_MS - _TOLERANCE_MS) / 1000
    _log(f"  Verifying it holds for at least {_EXPECTED_MS - _TOLERANCE_MS} ms...")
    deadline = time.monotonic() + min_hold_s
    while time.monotonic() < deadline:
        if _read_pin(_SUCCESS_PIN) != 0:
            held_ms = (time.monotonic() - active_at) * 1000
            device.wait()
            _log(f"FAIL: GPIO {_SUCCESS_PIN} went inactive after {held_ms:.0f} ms")
            sys.exit(1)
        time.sleep(_POLL_S)

    # Stage 3 — wait for pin to go inactive
    _log(f"  Waiting for GPIO {_SUCCESS_PIN} to go inactive...")
    if not _wait_for(_SUCCESS_PIN, 1, _WAIT_INACTIVE_S):
        device.wait()
        _log(f"FAIL: GPIO {_SUCCESS_PIN} never went inactive")
        sys.exit(1)

    held_ms = (time.monotonic() - active_at) * 1000
    device.wait()
    _log(f"PASS: GPIO {_SUCCESS_PIN} was active for {held_ms:.0f} ms")
    sys.exit(0)


if __name__ == "__main__":
    main()
