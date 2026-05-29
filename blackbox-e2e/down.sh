#!/usr/bin/env bash
# Stop the black-box e2e stack and remove its volumes (clean slate).
set -euo pipefail

cd "$(dirname "$0")"

# Target the dedicated Colima VM (see up.sh).
export DOCKER_CONTEXT=colima-prismo

echo "Stopping black-box e2e stack and removing volumes..."
docker compose -f docker-compose.yml down -v
echo "Done."
