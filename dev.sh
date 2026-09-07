#!/usr/bin/env bash
#
# One command to run Prismo locally: web app + MongoDB + MQTT broker.
# Everything runs in Docker — no local Node.js, Mongo or Mosquitto needed.
#
#   ./dev.sh              start everything and follow the app logs
#   ./dev.sh --help       all commands
#
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE=(docker compose -f docker-compose.dev.yml)

WEB_PORT_V="${WEB_PORT:-3000}"
MONGO_PORT_V="${MONGO_PORT:-27017}"
MQTT_PORT_V="${MQTT_PORT:-1883}"
MONGO_VIEWER_PORT_V="${MONGO_VIEWER_PORT:-5000}"

if [ -f .env ]; then
	# Only to render the URLs below — compose reads .env by itself.
	# shellcheck disable=SC1091
	set -a && . ./.env && set +a
	WEB_PORT_V="${WEB_PORT:-3000}"
	MONGO_PORT_V="${MONGO_PORT:-27017}"
	MQTT_PORT_V="${MQTT_PORT:-1883}"
	MONGO_VIEWER_PORT_V="${MONGO_VIEWER_PORT:-5000}"
fi

usage() {
	cat <<EOF
Prismo local development

Usage: ./dev.sh [command] [options]

Commands:
  up (default)     Start the stack, wait until it is ready, follow app logs
  down             Stop the stack (keeps database and MQTT data)
  reset            Stop the stack and delete all local data
  logs [service]   Follow logs (default: app)
  ps               Show service status
  shell            Open a shell inside the app container
  mqtt <args>      Run the MQTT read/write helper, e.g.
                     ./dev.sh mqtt --mode=read --topic='#'
  emulator <args>  Emulate a device over MQTT (no hardware needed), e.g.
                     ./dev.sh emulator scan my-device --uid=DEADBEEF --allowed=true
                     ./dev.sh emulator --help
  test [args]      Run the Playwright E2E suite against the running stack

Options for 'up':
  --with-worker    Also start the firmware build worker (multi-GB image,
                   only needed to work on /flasher firmware builds)
  --no-logs        Start and return instead of following logs

Port overrides: copy .env.example to .env and edit it.
EOF
}

require_docker() {
	if ! docker info >/dev/null 2>&1; then
		echo "Docker is not running. Start Docker Desktop (or 'colima start') and retry." >&2
		exit 1
	fi
}

port_owner() {
	lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

check_ports() {
	# Only meaningful on a cold start — once our own stack holds the ports,
	# re-running `up` is a no-op restart.
	[ -z "$("${COMPOSE[@]}" ps -q 2>/dev/null)" ] || return 0

	local conflict=0 name port var pid
	for entry in "web app:${WEB_PORT_V}:WEB_PORT" \
		"MongoDB:${MONGO_PORT_V}:MONGO_PORT" \
		"MQTT broker:${MQTT_PORT_V}:MQTT_PORT" \
		"MongoDB viewer:${MONGO_VIEWER_PORT_V}:MONGO_VIEWER_PORT"; do
		name="${entry%%:*}"
		port="$(echo "$entry" | cut -d: -f2)"
		var="$(echo "$entry" | cut -d: -f3)"
		pid="$(port_owner "$port")"
		if [ -n "$pid" ]; then
			echo "Port ${port} (${name}) is already in use by PID ${pid}." >&2
			echo "  Free it, or set ${var}=<other-port> in ./.env (see .env.example)." >&2
			conflict=1
		fi
	done
	[ "$conflict" -eq 0 ] || exit 1
}

wait_for_app() {
	local waited=0 timeout=300
	printf 'Waiting for the app to compile'
	while [ "$waited" -lt "$timeout" ]; do
		case "$("${COMPOSE[@]}" ps --format '{{.Health}}' app 2>/dev/null)" in
		healthy)
			echo " ready."
			return 0
			;;
		esac
		if [ -z "$("${COMPOSE[@]}" ps -q app 2>/dev/null)" ]; then
			echo
			echo "The app container exited. Recent logs:" >&2
			"${COMPOSE[@]}" logs --tail=40 app >&2
			exit 1
		fi
		printf '.'
		sleep 3
		waited=$((waited + 3))
	done
	echo
	echo "App did not become healthy within ${timeout}s. Check './dev.sh logs'." >&2
	exit 1
}

print_services() {
	cat <<EOF

  Web app        → http://localhost:${WEB_PORT_V}
  MongoDB viewer → http://localhost:${MONGO_VIEWER_PORT_V}   (admin / admin)
  MongoDB        → mongodb://localhost:${MONGO_PORT_V}/prismo
  MQTT broker    → mqtt://localhost:${MQTT_PORT_V}            (admin / admin)

  Sign in: click "Sign in with Google" — local dev uses a mock account,
  no Google credentials required.

  ./dev.sh emulator --help    simulate a device without hardware
  ./dev.sh --help             all commands

EOF
}

cmd_up() {
	local profiles=() follow=1
	while [ $# -gt 0 ]; do
		case "$1" in
		--with-worker) profiles+=(--profile worker) ;;
		--no-logs) follow=0 ;;
		*)
			echo "Unknown option for 'up': $1" >&2
			exit 1
			;;
		esac
		shift
	done

	require_docker
	check_ports

	echo "Starting the local stack (first run pulls images, this can take a few minutes)..."
	"${COMPOSE[@]}" ${profiles[@]+"${profiles[@]}"} up --build -d
	wait_for_app
	print_services

	if [ "$follow" -eq 1 ]; then
		echo "Following app logs — Ctrl+C detaches, the stack keeps running."
		"${COMPOSE[@]}" logs -f app
	fi
}

command="${1:-up}"
[ $# -gt 0 ] && shift || true

case "$command" in
up) cmd_up "$@" ;;
down)
	require_docker
	"${COMPOSE[@]}" --profile worker down
	echo "Stopped. Data is preserved — use './dev.sh reset' to wipe it."
	;;
reset)
	require_docker
	"${COMPOSE[@]}" --profile worker down -v
	echo "Stopped and removed all local data."
	;;
logs)
	require_docker
	"${COMPOSE[@]}" logs -f "${1:-app}"
	;;
ps)
	require_docker
	"${COMPOSE[@]}" --profile worker ps
	;;
shell)
	require_docker
	"${COMPOSE[@]}" exec app bash
	;;
mqtt)
	require_docker
	"${COMPOSE[@]}" exec app node /mqtt/mqtt.js "$@"
	;;
emulator)
	require_docker
	"${COMPOSE[@]}" exec -w /mqtt app npx tsx device-emulator.ts "$@"
	;;
test)
	require_docker
	if [ -z "$("${COMPOSE[@]}" --profile worker ps -q worker 2>/dev/null)" ]; then
		echo "Note: the firmware build worker is not running, so the firmware-download" >&2
		echo "spec will fail. Start it with './dev.sh up --with-worker' to run the" >&2
		echo "whole suite, or skip it with: ./dev.sh test --grep-invert firmware" >&2
		echo >&2
	fi
	"${COMPOSE[@]}" exec app bash -c \
		'ls -d /root/.cache/ms-playwright/chromium-* >/dev/null 2>&1 ||
			npx playwright install --with-deps chromium'
	"${COMPOSE[@]}" exec -e PLAYWRIGHT_BASE_URL=http://localhost:3000 \
		app npx playwright test "$@"
	;;
-h | --help | help) usage ;;
*)
	echo "Unknown command: $command" >&2
	echo >&2
	usage >&2
	exit 1
	;;
esac
