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

persistence false
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

    # Use mosquitto_ctrl only to compute the PBKDF2-SHA512 password hash, then
    # write the complete dynsec.json directly. This avoids running addRoleACL
    # via a temporary broker, whose argument syntax changes across mosquitto
    # 2.0.x patch releases.
    TEMP_INIT="/tmp/dynsec_init.json"
    mosquitto_ctrl dynsec init "${TEMP_INIT}" "${MQTT_ADMIN_USER}" "${MQTT_ADMIN_PASSWORD}"

    PASS=$(grep '"password"'   "${TEMP_INIT}" | sed 's/.*"password"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    SALT=$(grep '"salt"'       "${TEMP_INIT}" | sed 's/.*"salt"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    ITERS=$(grep '"iterations"' "${TEMP_INIT}" | sed 's/.*"iterations"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/')
    rm -f "${TEMP_INIT}"

    # Write a complete dynsec.json that grants the admin full publish/subscribe
    # access in addition to the dynsec management privilege created by init.
    cat > "${DYNSEC_FILE}" <<EOF
{
	"defaultACLAccess":{
		"publishClientSend":false,
		"publishClientReceive":true,
		"subscribe":false,
		"unsubscribe":true
	},
	"clients":[{
		"username":"${MQTT_ADMIN_USER}",
		"textname":"Dynsec admin user",
		"roles":[{"rolename":"${MQTT_ADMIN_USER}"}],
		"password":"${PASS}",
		"salt":"${SALT}",
		"iterations":${ITERS}
	}],
	"groups":[],
	"roles":[{
		"rolename":"${MQTT_ADMIN_USER}",
		"acls":[
			{"acltype":"publishClientSend","topic":"\$CONTROL/dynamic-security/#","priority":0,"allow":true},
			{"acltype":"publishClientSend","topic":"#","priority":0,"allow":true},
			{"acltype":"publishClientReceive","topic":"\$CONTROL/dynamic-security/#","priority":0,"allow":true},
			{"acltype":"publishClientReceive","topic":"\$SYS/#","priority":0,"allow":true},
			{"acltype":"publishClientReceive","topic":"#","priority":0,"allow":true},
			{"acltype":"subscribePattern","topic":"\$CONTROL/dynamic-security/#","priority":0,"allow":true},
			{"acltype":"subscribePattern","topic":"\$SYS/#","priority":0,"allow":true},
			{"acltype":"subscribePattern","topic":"#","priority":0,"allow":true},
			{"acltype":"unsubscribePattern","topic":"#","priority":0,"allow":true}
		]
	}]
}
EOF

    chown mosquitto:mosquitto "${DYNSEC_FILE}"
    chmod 0640 "${DYNSEC_FILE}"
    echo "[entrypoint] Dynamic security initialised with admin user '${MQTT_ADMIN_USER}'."
else
    echo "[entrypoint] Dynamic security file already exists, skipping init."
    chown mosquitto:mosquitto "${DYNSEC_FILE}"
    chmod 0640 "${DYNSEC_FILE}"
fi

exec /usr/sbin/mosquitto -c "${CONF_FILE}"
