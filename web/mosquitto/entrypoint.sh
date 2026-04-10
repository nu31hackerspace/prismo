#!/bin/sh
set -eu

: "${MQTT_ADMIN_USER:?need to set MQTT_ADMIN_USER}"
: "${MQTT_ADMIN_PASSWORD:?need to set MQTT_ADMIN_PASSWORD}"

MQTT_PORT="${MQTT_PORT:-1883}"
MQTT_TLS_PORT="${MQTT_TLS_PORT:-8883}"
DYNSEC_FILE="/mosquitto/data/dynsec.json"
CONF_FILE="/mosquitto/config/mosquitto.conf"

# Generate mosquitto.conf — plain listener (internal overlay only)
cat > "${CONF_FILE}" <<EOF
listener ${MQTT_PORT}
allow_anonymous false

plugin /usr/lib/mosquitto_dynamic_security.so
plugin_opt_config_file ${DYNSEC_FILE}

persistence true
persistence_location /mosquitto/data/
log_dest stdout
log_type all
EOF

# Append TLS listener when a domain is provided (production)
if [ -n "${MQTT_TLS_DOMAIN:-}" ]; then
    ACME_DIR="acme-v02.api.letsencrypt.org-directory"
    CERT_DIR="/caddy_storage/certificates/${ACME_DIR}/${MQTT_TLS_DOMAIN}"
    CERT_FILE="${CERT_DIR}/${MQTT_TLS_DOMAIN}.crt"
    KEY_FILE="${CERT_DIR}/${MQTT_TLS_DOMAIN}.key"

    echo "[entrypoint] Waiting for TLS certificate at ${CERT_FILE}..."
    WAITED=0
    until [ -f "${CERT_FILE}" ] && [ -f "${KEY_FILE}" ]; do
        if [ "${WAITED}" -ge 60 ]; then
            echo "[entrypoint] ERROR: TLS cert not found after 60s." \
                 "Ensure Caddy is running and DNS for ${MQTT_TLS_DOMAIN} is configured."
            exit 1
        fi
        sleep 5
        WAITED=$((WAITED + 5))
    done
    echo "[entrypoint] TLS certificate found."

    # Copy certs to a mosquitto-readable location — the caddy-data volume is
    # mounted read-only and Caddy owns the files (root:root 0600), so mosquitto
    # cannot read them directly.
    LOCAL_CERT_DIR="/mosquitto/data/tls"
    mkdir -p "${LOCAL_CERT_DIR}"
    cp "${CERT_FILE}" "${LOCAL_CERT_DIR}/server.crt"
    cp "${KEY_FILE}"  "${LOCAL_CERT_DIR}/server.key"
    chown mosquitto:mosquitto "${LOCAL_CERT_DIR}/server.crt" "${LOCAL_CERT_DIR}/server.key"
    chmod 0640 "${LOCAL_CERT_DIR}/server.crt" "${LOCAL_CERT_DIR}/server.key"

    cat >> "${CONF_FILE}" <<EOF

listener ${MQTT_TLS_PORT}
allow_anonymous false
cafile /etc/ssl/certs/ca-certificates.crt
certfile ${LOCAL_CERT_DIR}/server.crt
keyfile ${LOCAL_CERT_DIR}/server.key
EOF
fi

# Initialise dynamic security only on first boot (preserve existing device registrations)
if [ ! -f "${DYNSEC_FILE}" ]; then
    echo "[entrypoint] Initialising dynamic security plugin..."
    mosquitto_ctrl dynsec init "${DYNSEC_FILE}" "${MQTT_ADMIN_USER}" "${MQTT_ADMIN_PASSWORD}"
    chown mosquitto:mosquitto "${DYNSEC_FILE}"
    chmod 0640 "${DYNSEC_FILE}"
    echo "[entrypoint] Dynamic security initialised with admin user '${MQTT_ADMIN_USER}'."
else
    echo "[entrypoint] Dynamic security file already exists, skipping init."
    chown mosquitto:mosquitto "${DYNSEC_FILE}"
    chmod 0640 "${DYNSEC_FILE}"
fi

exec /usr/sbin/mosquitto -c "${CONF_FILE}"
