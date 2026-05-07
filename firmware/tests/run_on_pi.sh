#!/usr/bin/env bash
# run_on_pi.sh — Sync firmware to a Raspberry Pi and run tests there.
# Usage: bash tests/run_on_pi.sh <pi-host-or-ip> [pi-user]
#
# Example:
#   bash tests/run_on_pi.sh 192.168.1.42
#   bash tests/run_on_pi.sh raspberrypi.local pi

set -euo pipefail

PI_HOST="${1:-}"
PI_USER="${2:-pi}"

if [[ -z "$PI_HOST" ]]; then
    echo "Usage: $0 <pi-host-or-ip> [pi-user]"
    echo "Example: $0 192.168.1.42"
    exit 1
fi

FIRMWARE="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/home/${PI_USER}/prismo-firmware"

echo ">>> Syncing firmware to ${PI_USER}@${PI_HOST}:${REMOTE_DIR} ..."
rsync -az --delete \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude 'dist/' \
    --exclude 'build/' \
    --exclude '*.bin' \
    --exclude 'health.log*' \
    "${FIRMWARE}/" \
    "${PI_USER}@${PI_HOST}:${REMOTE_DIR}/"

echo ">>> Running tests on Pi..."
ssh "${PI_USER}@${PI_HOST}" "bash ${REMOTE_DIR}/tests/run_tests.sh"
