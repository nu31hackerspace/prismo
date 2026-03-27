#!/bin/bash
set -e
. /opt/esp-idf/export.sh
cd /opt/micropython/ports/esp32
make BOARD=ESP32_GENERIC_C3 FROZEN_MANIFEST=/firmware/manifest.py
