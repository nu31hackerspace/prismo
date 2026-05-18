#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Stopping dev environment and removing volumes..."
docker compose -f docker-compose.dev.yml down -v
echo "Done."
