#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Starting dev environment..."
docker compose -f docker-compose.dev.yml up --build -d

echo ""
echo "Services:"
echo "  SvelteKit app  → http://localhost:3000"
echo "  Mongo Express  → http://localhost:8081  (admin/admin)"
echo "  MQTT broker    → mqtt://localhost:1883  (admin/admin)"
echo ""
echo "MQTT helper (exec into app container):"
echo "  docker compose -f docker-compose.dev.yml exec app node /mqtt/mqtt.js --mode=read --topic='#'"
echo ""
echo "Tailing app logs (Ctrl+C to detach, services keep running)..."
docker compose -f docker-compose.dev.yml logs -f app
