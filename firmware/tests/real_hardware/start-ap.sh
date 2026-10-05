#!/bin/bash
# test-ap.sh — stop any existing AP on wlan0, start a fresh one, print status.
# No subcommands, no prompts. Just run it.

set -e

AP_NAME="prismo-ap"
SSID="PrismoTest"
PSK="prismotest123"
AP_IP="192.168.10.1/24"
IFACE="wlan0"
# Without an explicit channel the radio picks one on every bring-up. Pin one
# inside 1-11, which every ESP32-C3 country setting scans (12-13 are passive or
# skipped), so the device's WiFi scan can't miss the AP.
CHANNEL="${AP_CHANNEL:-6}"

# True when the radio is really in AP mode serving our SSID. NetworkManager
# reports the hotspot "activated" even on bring-ups the device can't see. If
# iw is not installed we can't tell, so assume yes.
ap_serving() {
    command -v iw >/dev/null 2>&1 || return 0
    local info
    info=$(iw dev "$IFACE" info 2>/dev/null) || return 1
    grep -q '^[[:space:]]*type AP' <<<"$info" \
        && grep -q "^[[:space:]]*ssid ${SSID}\$" <<<"$info"
}

# ----- 1. Stop anything currently on wlan0 -----
echo "[*] Bringing down anything on $IFACE..."

ACTIVE=$(nmcli -t -f NAME,DEVICE con show --active | awk -F: -v dev="$IFACE" '$2==dev {print $1}')
for con in $ACTIVE; do
    echo "    -> down: $con"
    sudo nmcli con down "$con" || true
done

# Force-disconnect the device (handles netplan/auto-managed cases)
sudo nmcli device disconnect "$IFACE" 2>/dev/null || true

# Remove any leftover AP profile from a previous run
if nmcli -t -f NAME con show | grep -qx "$AP_NAME"; then
    sudo nmcli con delete "$AP_NAME"
    echo "    -> removed old $AP_NAME profile"
fi

# ----- 2. Start fresh AP -----
echo "[*] Making sure WiFi radio is on..."
sudo rfkill unblock wifi
sudo nmcli radio wifi on

echo "[*] Creating AP profile $AP_NAME (SSID=$SSID)..."
sudo nmcli con add type wifi ifname "$IFACE" con-name "$AP_NAME" \
    autoconnect no ssid "$SSID"

# Force WPA2 (RSN/CCMP): without an explicit proto NetworkManager brings the AP
# up as WPA1/TKIP, which the ESP32-C3 refuses to join (ESP-IDF default authmode
# threshold is WPA2 — wlan.status() returns 211 NO_AP_FOUND_IN_AUTHMODE_THRESHOLD).
sudo nmcli con modify "$AP_NAME" \
    802-11-wireless.mode ap \
    802-11-wireless.band bg \
    802-11-wireless.channel "$CHANNEL" \
    802-11-wireless.powersave 2 \
    ipv4.method shared \
    ipv4.addresses "$AP_IP" \
    wifi-sec.key-mgmt wpa-psk \
    wifi-sec.proto rsn \
    wifi-sec.pairwise ccmp \
    wifi-sec.group ccmp \
    wifi-sec.psk "$PSK"

# Up to 3 tries: a bring-up that leaves the radio out of AP mode is torn down
# and repeated instead of being handed to the tests as "active".
for attempt in 1 2 3; do
    echo "[*] Bringing AP up (attempt $attempt)..."
    sudo nmcli con up "$AP_NAME" ifname "$IFACE" || true
    for _ in $(seq 1 10); do
        if ap_serving; then break 2; fi
        sleep 1
    done
    echo "    -> radio is not serving $SSID, retrying"
    sudo nmcli con down "$AP_NAME" || true
done

# Give NM a moment to assign IP and start dnsmasq
sleep 1

# ----- 3. Print status -----
echo
echo "===== AP STATUS ====="
if nmcli -t -f NAME,DEVICE con show --active | grep -q "^${AP_NAME}:${IFACE}$" && ap_serving; then
    echo "[+] AP $AP_NAME is ACTIVE on $IFACE"
    ip -4 addr show "$IFACE" | grep -w inet || true
    if command -v iw >/dev/null 2>&1; then
        iw dev "$IFACE" info | grep -E '^\s*(type|ssid|channel)' | sed 's/^\s*/    radio: /' || true
    fi
    echo "    SSID: $SSID"
    echo "    PSK:  $PSK"
    if [ -f /var/lib/NetworkManager/dnsmasq-"$IFACE".leases ]; then
        echo "    Leases:"
        cat /var/lib/NetworkManager/dnsmasq-"$IFACE".leases | sed 's/^/      /'
    else
        echo "    Leases: (none yet — no clients connected)"
    fi
else
    echo "[-] AP failed to come up."
    exit 1
fi
echo "====================="
