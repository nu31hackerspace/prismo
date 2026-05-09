#!/usr/bin/env bash
# run_gpio_tests.sh — Flash device and run hardware GPIO verification via relay.
#
# Requires a relay module wired between the ESP32-C3 and Raspberry Pi GPIO.
# See test-stand/README.md for wiring instructions and verify_relay.py to
# confirm the relay is connected correctly before running this script.
#
# Usage:
#   bash tests/run_gpio_tests.sh [port]
#
# Environment:
#   ESP32_PORT — serial port override (takes precedence over $1)

set -euo pipefail

FIRMWARE="$(cd "$(dirname "$0")/.." && pwd)"
MICROPYTHON_BIN="${FIRMWARE}/ESP32_GENERIC_C3-20251209-v1.27.0.bin"

# ---------------------------------------------------------------------------
# esptool detection
# ---------------------------------------------------------------------------
if command -v esptool &>/dev/null; then
    ESPTOOL=esptool
elif command -v esptool.py &>/dev/null; then
    ESPTOOL=esptool.py
else
    echo "ERROR: Neither 'esptool' nor 'esptool.py' found on PATH."
    exit 1
fi

if [[ ! -f "$MICROPYTHON_BIN" ]]; then
    echo "ERROR: MicroPython binary not found: $MICROPYTHON_BIN"
    exit 1
fi

echo ""
echo "======================================================"
echo " Prismo GPIO Hardware Test"
echo " Port:   $ESP32_PORT"
echo " Binary: $(basename "$MICROPYTHON_BIN")"
echo "======================================================"

# ---------------------------------------------------------------------------
# Step 1: Erase flash
# ---------------------------------------------------------------------------
echo ""
echo "[1/3] Erasing flash..."
"$ESPTOOL" --chip esp32c3 --port "$ESP32_PORT" erase-flash

# ---------------------------------------------------------------------------
# Step 2: Flash MicroPython
# ---------------------------------------------------------------------------
echo ""
echo "[2/3] Flashing MicroPython..."
"$ESPTOOL" --chip esp32c3 --port "$ESP32_PORT" --baud 460800 \
    --before default-reset --after hard-reset \
    write-flash 0x0 "$MICROPYTHON_BIN"

echo ">>> Waiting for device to boot..."
sleep 4

# ---------------------------------------------------------------------------
# Step 3: Emulate PN532 card scan and verify Pi GPIO response
# ---------------------------------------------------------------------------
echo ""
echo "[3/3] Running card-scan GPIO test..."
echo "      Relay must be wired — see test-stand/README.md"
echo ""

if python3 "${FIRMWARE}/tests/pi_gpio_monitor.py"; then
    echo ""
    echo "======================================================"
    echo "=== GPIO TESTS PASSED ==="
    echo "======================================================"
    exit 0
else
    echo ""
    echo "======================================================"
    echo "=== GPIO TESTS FAILED ==="
    echo "======================================================"
    exit 1
fi
