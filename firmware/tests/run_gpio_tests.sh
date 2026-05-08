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

# ---------------------------------------------------------------------------
# Port detection
# ---------------------------------------------------------------------------
PORT="${ESP32_PORT:-${1:-}}"
if [[ -z "$PORT" ]]; then
    PORT=$(mpremote devs 2>/dev/null | awk 'NR==1{print $1}' || true)
    if [[ -z "$PORT" ]]; then
        echo "ERROR: No device detected. Plug in the ESP32 or pass the port as the first argument."
        echo "       List connected devices with: mpremote devs"
        exit 1
    fi
    echo ">>> Auto-detected device: $PORT"
fi

if [[ ! -f "$MICROPYTHON_BIN" ]]; then
    echo "ERROR: MicroPython binary not found: $MICROPYTHON_BIN"
    exit 1
fi

echo ""
echo "======================================================"
echo " Prismo GPIO Hardware Test"
echo " Port:   $PORT"
echo " Binary: $(basename "$MICROPYTHON_BIN")"
echo "======================================================"

# ---------------------------------------------------------------------------
# Step 1: Erase flash
# ---------------------------------------------------------------------------
echo ""
echo "[1/4] Erasing flash..."
"$ESPTOOL" --chip esp32c3 --port "$PORT" erase-flash

# ---------------------------------------------------------------------------
# Step 2: Flash MicroPython
# ---------------------------------------------------------------------------
echo ""
echo "[2/4] Flashing MicroPython..."
"$ESPTOOL" --chip esp32c3 --port "$PORT" --baud 460800 \
    --before default-reset --after hard-reset \
    write-flash 0x0 "$MICROPYTHON_BIN"

echo ">>> Waiting for device to boot..."
sleep 4

# ---------------------------------------------------------------------------
# Step 3: Install unittest
# ---------------------------------------------------------------------------
echo ""
echo "[3/4] Installing unittest on device..."
mpremote connect "$PORT" mip install unittest || true

# ---------------------------------------------------------------------------
# Step 4: Run GPIO hardware test via Pi GPIO monitor
# ---------------------------------------------------------------------------
echo ""
echo "[4/4] Running GPIO hardware test..."
echo "      Relay must be wired — see test-stand/README.md"
echo ""

if ESP32_PORT="$PORT" python3 "${FIRMWARE}/tests/pi_gpio_monitor.py"; then
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
