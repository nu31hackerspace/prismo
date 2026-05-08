#!/usr/bin/env python3
"""
Pi-side GPIO monitor for Prismo hardware verification.
Runs test_gpio_real.py on the ESP32-C3 via mpremote, monitors relay contacts.

═══════════════════════════════════════════════════════════════════════════════
RELAY WIRING — full galvanic isolation between ESP32-C3 and Raspberry Pi
═══════════════════════════════════════════════════════════════════════════════

You need two single-channel relay modules (one for success, one for error).
Use modules labelled "active HIGH" or "3.3 V trigger" — these energize the
coil when IN goes HIGH, which matches the device firmware.

  ┌─────────────────────────────────────────────────────────────────────────┐
  │  RELAY MODULE (×2 — one per channel)                                   │
  │                                                                         │
  │  COIL SIDE (IoT device)          CONTACT SIDE (Raspberry Pi)           │
  │  ─────────────────────           ──────────────────────────            │
  │  VCC  ← 3.3 V (ESP32-C3 3V3)    COM  → Pi GND  (pin 9 or 14)         │
  │  GND  ← GND   (ESP32-C3 GND)    NO   → Pi BCM  (see table below)     │
  │  IN   ← GPIO  (see table below)                                        │
  └─────────────────────────────────────────────────────────────────────────┘

  ESP32-C3 GPIO 2 (success) → Relay-1 IN   Relay-1 NO → Pi BCM 17 (pin 11)
  ESP32-C3 GPIO 1 (error)   → Relay-2 IN   Relay-2 NO → Pi BCM 27 (pin 13)
  ESP32-C3 3V3              → Both relay VCC
  ESP32-C3 GND              → Both relay GND (coil side only)
  Pi GND (pin 9 or 14)      → Both relay COM (contact side)

SIGNAL LOGIC:
  Device GPIO HIGH → relay energizes → NO closes → Pi pin pulled to GND (LOW)
  Device GPIO LOW  → relay releases  → NO opens  → Pi pin pulled HIGH (internal)
  Pi uses internal pull-up. gpiozero when_activated fires on LOW = relay closed.

IF YOUR MODULE IS ACTIVE LOW (common on blue Chinese boards):
  Swap NO for NC on the contact side. The coil will be energized during idle
  and release when the device fires — contacts invert but logic stays correct.
  Note: the relay coil draws current continuously in this configuration.

ISOLATION:
  The relay contact side carries no voltage from the ESP32-C3 circuit.
  The Pi and the IoT device do NOT share any ground reference.
  A fault or spike on the device cannot reach the Pi GPIO header.

Usage:
  python3 tests/pi_gpio_monitor.py [/dev/ttyACM0]
  ESP32_PORT=/dev/ttyACM0 python3 tests/pi_gpio_monitor.py

Requires: gpiozero  (pre-installed on Raspberry Pi OS)
          mpremote  (pip install mpremote)
"""

import os
import subprocess
import sys
import threading
import time

# ---------------------------------------------------------------------------
# Hardware pin mapping
# ---------------------------------------------------------------------------
PI_BCM_SUCCESS = 17   # wired to ESP32-C3 GPIO 2
PI_BCM_ERROR   = 27   # wired to ESP32-C3 GPIO 1

# ---------------------------------------------------------------------------
# Timing tolerances (10 % below firmware config values)
# config.SUCCESS_SIGNAL_DURATION = 5000 ms
# config.ERROR_SIGNAL_DURATION   = 1000 ms
# ---------------------------------------------------------------------------
SUCCESS_MIN_MS = 4500
ERROR_MIN_MS   =  900

# ---------------------------------------------------------------------------
# GPIO setup
# ---------------------------------------------------------------------------
try:
    from gpiozero import DigitalInputDevice
    _GPIO_AVAILABLE = True
except ImportError:
    _GPIO_AVAILABLE = False
    print("WARNING: gpiozero not found — GPIO checks skipped")
    print("         Install with: pip install gpiozero")

_events: list[dict] = []
_lock = threading.Lock()


def _record(pin_name: str, state: str) -> None:
    with _lock:
        _events.append({"pin": pin_name, "state": state, "time": time.monotonic()})


class _PinWatcher:
    def __init__(self):
        self._success = self._error = None
        if not _GPIO_AVAILABLE:
            return
        # pull_up=True: Pi internal pull-up keeps pin HIGH when relay contact is open.
        # Relay NO closes to GND when coil energizes → pin goes LOW → when_activated fires.
        self._success = DigitalInputDevice(PI_BCM_SUCCESS, pull_up=True)
        self._error   = DigitalInputDevice(PI_BCM_ERROR,   pull_up=True)
        self._success.when_activated   = lambda: _record("success", "high")
        self._success.when_deactivated = lambda: _record("success", "low")
        self._error.when_activated     = lambda: _record("error",   "high")
        self._error.when_deactivated   = lambda: _record("error",   "low")

    def close(self):
        if self._success:
            self._success.close()
        if self._error:
            self._error.close()


# ---------------------------------------------------------------------------
# Signal verifiers
# ---------------------------------------------------------------------------

def _verify_timed_pulse(pin_name: str, events: list, min_ms: float):
    highs = [e for e in events if e["pin"] == pin_name and e["state"] == "high"]
    lows  = [e for e in events if e["pin"] == pin_name and e["state"] == "low"]
    other = [e for e in events if e["pin"] != pin_name]

    if other:
        return False, f"unexpected {other[0]['pin']} pin activity"
    if not highs:
        return False, f"{pin_name} pin never went HIGH"
    if not lows:
        return False, f"{pin_name} pin never returned LOW"

    duration_ms = (lows[-1]["time"] - highs[0]["time"]) * 1000
    if duration_ms < min_ms:
        return False, f"{pin_name} HIGH for {duration_ms:.0f} ms (expected >= {min_ms:.0f} ms)"
    return True, f"{pin_name} HIGH for {duration_ms:.0f} ms"


def _verify_went_high(pin_name: str, events: list):
    highs = [e for e in events if e["pin"] == pin_name and e["state"] == "high"]
    if not highs:
        return False, f"{pin_name} pin never went HIGH"
    return True, f"{pin_name} went HIGH"


def _verify_went_low(pin_name: str, events: list):
    lows = [e for e in events if e["pin"] == pin_name and e["state"] == "low"]
    if not lows:
        return False, f"{pin_name} pin never went LOW"
    return True, f"{pin_name} went LOW"


_VERIFIERS = {
    "EXPECT_SUCCESS":     lambda ev: _verify_timed_pulse("success", ev, SUCCESS_MIN_MS),
    "EXPECT_ERROR":       lambda ev: _verify_timed_pulse("error",   ev, ERROR_MIN_MS),
    "EXPECT_MACHINE_ON":  lambda ev: _verify_went_high("success", ev),
    "EXPECT_MACHINE_OFF": lambda ev: _verify_went_low("success",  ev),
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _detect_port() -> str | None:
    out = subprocess.run(["mpremote", "devs"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        parts = line.strip().split()
        if parts:
            return parts[0]
    return None


def main():
    port = os.environ.get("ESP32_PORT") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not port:
        port = _detect_port()
        if not port:
            print("ERROR: No ESP32 device found. Pass port as argument or set ESP32_PORT.")
            sys.exit(1)
        print(f"Auto-detected port: {port}")

    firmware_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    test_script  = os.path.join(firmware_dir, "tests", "test_gpio_real.py")

    watcher = _PinWatcher()

    mpremote_cmd = [
        "mpremote", "connect", port,
        "mount", firmware_dir,
        "run", test_script,
    ]

    results: dict[str, tuple[bool | None, str]] = {}
    scenario      = None
    window_start  = None
    verifier_key  = None

    print("Running hardware GPIO test on device...")
    print()

    proc = subprocess.Popen(
        mpremote_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )

    for raw in proc.stdout:
        line = raw.rstrip()
        print(f"  [device] {line}")

        if not line.startswith("GPIO_TEST:"):
            continue

        parts = line.split(":")
        if len(parts) < 3:
            continue
        _, name, event = parts[0], parts[1], parts[2]

        if event == "START":
            scenario     = name
            window_start = time.monotonic()
            with _lock:
                _events.clear()

        elif event in _VERIFIERS:
            verifier_key = event
            window_start = time.monotonic()
            with _lock:
                _events.clear()

        elif event == "DONE" and scenario:
            if verifier_key:
                if _GPIO_AVAILABLE:
                    with _lock:
                        window_events = [e for e in _events if e["time"] >= (window_start or 0)]
                    passed, msg = _VERIFIERS[verifier_key](window_events)
                    results[scenario] = (passed, msg)
                else:
                    results[scenario] = (None, "skipped — gpiozero not available")
            scenario = verifier_key = None

        elif name == "ALL" and event == "COMPLETE":
            break

    proc.wait()
    watcher.close()

    print()
    print("=" * 54)
    print("  Prismo GPIO Hardware Test Results")
    print("=" * 54)

    failed = 0
    for test_name, (passed, msg) in results.items():
        if passed is None:
            status = "SKIP"
        elif passed:
            status = "PASS"
        else:
            status = "FAIL"
            failed += 1
        print(f"  [{status}] {test_name}: {msg}")

    print("=" * 54)
    if failed:
        print(f"  {failed} test(s) FAILED")
        sys.exit(1)
    else:
        print("  ALL PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
