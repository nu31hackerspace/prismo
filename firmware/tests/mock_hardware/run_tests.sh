#!/usr/bin/env bash
# run_tests.sh — Clean-flash MicroPython onto the device and run e2e tests.
# Usage: bash tests/run_tests.sh [port]
#   port — USB serial port (e.g. /dev/ttyACM0, /dev/cu.usbmodem1101).
#          Omit to auto-detect via `mpremote devs`.
#
# Environment variables (all optional, for CI):
#   ESP32_PORT  — serial port override (takes precedence over $1)

set -euo pipefail

FIRMWARE="$(cd "$(dirname "$0")/../.." && pwd)"
MICROPYTHON_BIN="${FIRMWARE}/ESP32_GENERIC_C3-20251209-v1.27.0.bin"
TEST_FILE_LIST=(
    "${FIRMWARE}/tests/mock_hardware/test_keys_updates.py"
    "${FIRMWARE}/tests/mock_hardware/test_reconnect.py"
)

# ---------------------------------------------------------------------------
# esptool detection: prefer `esptool`, fall back to `esptool.py`
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


if [[ ! -f "$MICROPYTHON_BIN" ]]; then
    echo "ERROR: MicroPython binary not found: $MICROPYTHON_BIN"
    exit 1
fi

echo ""
echo "======================================================"
echo " Prismo Firmware Test Runner"
echo " Port:   $PORT"
echo " Binary: $(basename "$MICROPYTHON_BIN")"
echo " Tests:  ${TEST_FILE_LIST[*]}"
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
# Step 3: Install unittest (written to device flash, persists across mount)
# ---------------------------------------------------------------------------
echo ""
echo "[3/4] Installing unittest on device..."
mpremote connect "$PORT" mip install unittest || true

# ---------------------------------------------------------------------------
# Step 4: Run tests
# `mount` makes the firmware directory the root filesystem on the device, so
# all `src/` and `libs/` imports resolve from the host without uploading files.
# ---------------------------------------------------------------------------
echo ""
echo "[4/4] Running tests..."
FAILED=0
for test_file in "${TEST_FILE_LIST[@]}"; do
    echo ""
    echo "--- Running: $(basename "$test_file") ---"
    output=$(mpremote connect "$PORT" mount "$FIRMWARE" run "$test_file" 2>&1 || true)
    echo "$output"

    if ! echo "$output" | grep -q "OK"; then
        FAILED=1
    fi
done

echo ""
if [[ "$FAILED" -eq 0 ]]; then
    echo "======================================================"
    echo "=== TESTS PASSED ==="
    echo "======================================================"
    exit 0
else
    echo "======================================================"
    echo "=== TESTS FAILED ==="
    echo "======================================================"
    exit 1
fi
