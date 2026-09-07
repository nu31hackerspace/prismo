#!/usr/bin/env bash
# Kept for backwards compatibility — use ./dev.sh down (or ./dev.sh reset).
set -euo pipefail
cd "$(dirname "$0")"
exec ./dev.sh reset
