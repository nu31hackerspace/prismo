#!/usr/bin/env bash

# Exit immediately if a command fails
set -e

# Save our current working directory (your firmware folder)
export PROJECT_DIR=$(pwd)

echo "Starting build process in $PROJECT_DIR..."

echo "GIT_COMMIT = \"$(git rev-parse --short HEAD)\"" > "$PROJECT_DIR/src/build_info.py"

# ---------------------------------------------------------
# Step A: Setup ESP-IDF (The Espressif Toolchain)
# ---------------------------------------------------------
mkdir -p build
cd build

if [ -n "$IDF_PATH" ] && [ -f "$IDF_PATH/export.sh" ]; then
    echo "Using preinstalled ESP-IDF at $IDF_PATH"
    . "$IDF_PATH/export.sh"
else
    if [ ! -d "esp-idf" ]; then
        echo "Cloning ESP-IDF..."
        git clone -b v5.5.1 --recursive https://github.com/espressif/esp-idf.git
    else
        echo "ESP-IDF already exists, skipping clone."
    fi

    cd esp-idf
    ./install.sh esp32c3
    . ./export.sh
    cd ..
fi

# ---------------------------------------------------------
# Step B: Setup MicroPython
# ---------------------------------------------------------
if [ ! -d "micropython" ]; then
    echo "Cloning MicroPython..."
    git clone -b v1.27.0 --recursive https://github.com/micropython/micropython.git
else
    echo "MicroPython already exists, skipping clone."
fi

cd micropython

# Build mpy-cross (The MicroPython cross-compiler)
echo "Building mpy-cross..."
make -C mpy-cross

# ---------------------------------------------------------
# Step C: Build Your Custom Firmware
# ---------------------------------------------------------
cd ports/esp32

# Fetch ESP32 dependencies
echo "Fetching ESP32 submodules..."
make BOARD=ESP32_GENERIC_C3 submodules

# Clear stale frozen artifacts so manifest changes are always picked up
echo "Clearing stale frozen artifacts..."
# Compile the firmware using YOUR manifest file!

echo "Compiling MicroPython firmware..."
make BOARD=ESP32_GENERIC_C3 FROZEN_MANIFEST="$PROJECT_DIR/manifest.py"

# ---------------------------------------------------------
# Step D: Retrieve the final binaries
# ---------------------------------------------------------
echo "Copying binaries to project root..."
mkdir -p "$PROJECT_DIR/dist"
cp build-ESP32_GENERIC_C3/bootloader/bootloader.bin "$PROJECT_DIR/dist/bootloader.bin"
cp build-ESP32_GENERIC_C3/partition_table/partition-table.bin "$PROJECT_DIR/dist/partition-table.bin"
cp build-ESP32_GENERIC_C3/micropython.bin "$PROJECT_DIR/dist/micropython.bin"
# Also keep the combined bin for reference
cp build-ESP32_GENERIC_C3/firmware.bin "$PROJECT_DIR/dist/firmware.bin"

echo "====================================================="
echo "✅ SUCCESS! Binaries ready in: $PROJECT_DIR/dist/"
echo "   Now run: ./flash.sh"
echo "====================================================="