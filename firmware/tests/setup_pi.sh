#!/usr/bin/env bash
# setup_pi.sh — One-time setup for running firmware tests on a Raspberry Pi.
# Run this script directly on the Pi.

set -euo pipefail

echo ">>> Installing Python dependencies..."
python3 -m pip install --upgrade mpremote

echo ">>> Adding current user to 'dialout' group for USB serial access..."
sudo usermod -aG dialout "$USER"

echo ""
echo "=== Pi setup complete ==="
echo "IMPORTANT: Log out and back in (or reboot) for the group change to take effect."
echo "Then plug in the ESP32 and verify it appears with: ls /dev/ttyUSB* /dev/ttyACM*"
echo "Run tests with: bash tests/run_tests.sh"
