#!/usr/bin/env bash
# run_tests.sh — Local e2e test runner for Prismo firmware

set -euo pipefail

DEVICE="${1:-auto}"
MPREMOTE="mpremote connect ${DEVICE}"
FIRMWARE="$(cd "$(dirname "$0")/.." && pwd)"

echo ">>> Installing test dependencies on device..."
# Install unittest standard library to the device's /lib for testing only
$MPREMOTE mip install unittest || true

echo ">>> Running End-to-End User Flow Test..."
# Note: we mount the firmware directory so the paths resolve correctly on-device
output=$($MPREMOTE mount "${FIRMWARE}" run "${FIRMWARE}/tests/test_e2e_scan.py" 2>&1 || true)
echo "$output"

if echo "$output" | grep -q "OK"; then
    echo "=== E2E TEST PASSED ==="
    exit 0
else
    echo "=== E2E TEST FAILED ==="
    exit 1
fi
