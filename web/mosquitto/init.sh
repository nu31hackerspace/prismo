#!/bin/sh
set -e
CONFIG=/mosquitto/data/dynamic-security.json
if [ ! -f "$CONFIG" ]; then
  echo "Initializing dynamic security with admin: ${USERNAME}"
  mosquitto_ctrl dynsec init "$CONFIG" "${USERNAME}" "${PASSWORD}"
fi
exec mosquitto -c /mosquitto/config/mosquitto.conf
