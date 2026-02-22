#!/usr/bin/env bash

# Exit immediately if a command fails
set -e

PROJECT_DIR=$(pwd)
PORT="${1:-/dev/cu.usbmodem1101}"
DIST="$PROJECT_DIR/dist"

echo "======================================================"
echo " Prismo Firmware Flasher"
echo " Port: $PORT"
echo "======================================================"

# Check required files exist
if [ ! -f "$DIST/firmware.bin" ]; then
    echo "❌ ERROR: Build artifacts not found in ./dist/"
    echo "   Please run ./build.sh first."
    exit 1
fi

# --------------------------------------------------------------
# Step 1: Erase flash
# --------------------------------------------------------------
echo ""
echo "[1/2] Erasing flash on $PORT..."
esptool --chip esp32c3 --port "$PORT" erase-flash

# --------------------------------------------------------------
# Step 2: Flash all 3 parts at their correct offsets
# --------------------------------------------------------------
echo ""
echo "[2/2] Flashing firmware..."
echo "      firmware.bin → 0x00000"
esptool --chip esp32c3 --port "$PORT" --baud 460800 \
  --before default-reset --after hard-reset \
  write-flash \
  --flash-mode dio --flash-size 4MB --flash-freq 80m \
  0x00000 "$DIST/firmware.bin"

echo ""
echo "======================================================"
echo "✅ Done! The firmware is self-contained — no files"
echo "   need to be uploaded separately."
echo ""
echo "⚠️  ACTION REQUIRED: The ESP32-C3 USB-JTAG will NOT"
echo "   boot automatically. You MUST power-cycle the board:"
echo ""
echo "   1. Unplug the USB cable"
echo "   2. Wait 2 seconds"
echo "   3. Plug it back in"
echo ""
echo "   Then check your WiFi for: 00_prismo"
echo "======================================================"
