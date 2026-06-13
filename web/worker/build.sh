#!/bin/bash
set -e
. /opt/esp-idf/export.sh
cd /opt/micropython/ports/esp32
rm -f build-ESP32_GENERIC_C3/frozen_content.c
rm -rf build-ESP32_GENERIC_C3/frozen_mpy
make BOARD=ESP32_GENERIC_C3 FROZEN_MANIFEST=/firmware/manifest.py
