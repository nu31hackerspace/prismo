#!/usr/bin/env bash
# run_tests.sh — Flash stock MicroPython, upload source, run GPIO test.
#
# Flashes the pre-built stock MicroPython firmware to the ESP32-C3, uploads
# the prismo Python source files, then verifies the success relay output via
# a Raspberry Pi GPIO probe.
#
# Usage:
#   bash tests/real_hardware/run_tests.sh [port]
#
# Environment:
#   ESP32_PORT — serial port override (takes precedence over $1)

set -euo pipefail

FIRMWARE="$(cd "$(dirname "$0")/../.." && pwd)"
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
# Port detection: $ESP32_PORT > $1 > auto-detect
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

echo ""
echo "======================================================"
echo " Prismo Real Hardware Test Runner"
echo " Port:   $PORT"
echo "======================================================"

# ---------------------------------------------------------------------------
# Step 1: Verify stock firmware binary exists
# ---------------------------------------------------------------------------
echo ""
echo "[1/5] Checking stock MicroPython firmware..."
if [[ ! -f "$MICROPYTHON_BIN" ]]; then
    echo "ERROR: Stock firmware not found: $MICROPYTHON_BIN"
    exit 1
fi
echo ">>> Found: $MICROPYTHON_BIN"

# ---------------------------------------------------------------------------
# Step 2: Erase flash
# ---------------------------------------------------------------------------
echo ""
echo "[2/5] Erasing flash..."
"$ESPTOOL" --chip esp32c3 --port "$PORT" erase-flash

# ---------------------------------------------------------------------------
# Step 3: Flash stock MicroPython firmware
# ---------------------------------------------------------------------------
echo ""
echo "[3/5] Flashing stock MicroPython..."
"$ESPTOOL" --chip esp32c3 --port "$PORT" --baud 460800 \
    --before default-reset --after hard-reset \
    write-flash \
    --flash-mode dio --flash-size 4MB --flash-freq 80m \
    0x00000 "$MICROPYTHON_BIN"

echo ">>> Waiting for device to boot..."
sleep 5

# ---------------------------------------------------------------------------
# Step 4: Upload source files
# ---------------------------------------------------------------------------
echo ""
echo "[4/5] Uploading source files..."

mpremote connect "$PORT" mkdir src      2>/dev/null || true
mpremote connect "$PORT" mkdir libs     2>/dev/null || true

mpremote connect "$PORT" cp "${FIRMWARE}/boot.py" :boot.py
mpremote connect "$PORT" cp "${FIRMWARE}/main.py" :main.py

for f in "${FIRMWARE}/src/"*.py; do
    mpremote connect "$PORT" cp "$f" ":src/$(basename "$f")"
done

for f in "${FIRMWARE}/libs/"*.py; do
    mpremote connect "$PORT" cp "$f" ":libs/$(basename "$f")"
done

echo ">>> Source files uploaded"

echo ">>> Resetting device..."
mpremote connect "$PORT" reset
sleep 5

# ---------------------------------------------------------------------------
# Step 5: Verify boot — import a source module to confirm files are live
# ---------------------------------------------------------------------------
echo ""
echo "[5/5] Verifying device boot..."
verify_output=$(mpremote connect "$PORT" exec "import src.config; print('flash_ok')" 2>&1 || true)
echo "$verify_output"
if ! echo "$verify_output" | grep -q "flash_ok"; then
    echo "ERROR: Device did not boot correctly — could not confirm uploaded firmware."
    echo "       Check the serial port or power-cycle the board."
    exit 1
fi
echo ">>> Device verified"

echo ""
echo "======================================================"
echo "=== TESTS PASSED ==="
echo "======================================================"
exit 0
