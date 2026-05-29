#!/usr/bin/env bash
# Build and start the production-faithful stack for black-box e2e tests.
# Waits until the app reports healthy, then prints how to reach it.
set -euo pipefail

cd "$(dirname "$0")"

# Pin to the dedicated Colima VM so this stack is fully isolated from other
# projects and never depends on whichever docker context is currently active.
# Start it first if it isn't running: colima start prismo --cpus 2 --memory 6 ...
export DOCKER_CONTEXT=colima-prismo

if ! docker context inspect "$DOCKER_CONTEXT" >/dev/null 2>&1; then
  echo "ERROR: docker context '$DOCKER_CONTEXT' not found."
  echo "Start the dedicated VM first:"
  echo "  colima start prismo --cpus 2 --memory 6 --disk 256 --arch aarch64 --vm-type vz --mount-type virtiofs --network-address"
  exit 1
fi

COMPOSE="docker compose -f docker-compose.yml"

echo "Building and starting black-box e2e stack (production build)..."
$COMPOSE up --build -d

echo ""
echo "Waiting for the app to become healthy..."
for i in $(seq 1 60); do
  status=$($COMPOSE ps app --format '{{.Health}}' 2>/dev/null || true)
  if [ "$status" = "healthy" ]; then
    echo "App is healthy."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: app did not become healthy in time. Recent logs:"
    $COMPOSE logs --tail 50 app
    exit 1
  fi
  sleep 2
done

echo ""
echo "Stack is up:"
echo "  Web app (production build) → http://localhost:3000"
echo "  MongoDB                    → mongodb://localhost:27017/prismo"
echo "  MQTT broker                → mqtt://admin:admin@localhost:1883"
echo ""
echo "Tail logs:  docker compose -f blackbox-e2e/docker-compose.yml logs -f app"
echo "Tear down:  ./blackbox-e2e/down.sh"
