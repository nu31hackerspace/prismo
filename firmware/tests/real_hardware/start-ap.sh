#!/bin/bash
# test-ap.sh — stop any existing AP on wlan0, start a fresh one, print status.
# No subcommands, no prompts. Just run it.

set -e

AP_NAME="prismo-ap"
SSID="PrismoTest"
PSK="prismotest123"
AP_IP="192.168.10.1/24"
IFACE="wlan0"

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

sudo nmcli con modify "$AP_NAME" \
    802-11-wireless.mode ap \
    802-11-wireless.band bg \
    ipv4.method shared \
    ipv4.addresses "$AP_IP" \
    wifi-sec.key-mgmt wpa-psk \
    wifi-sec.psk "$PSK"

echo "[*] Bringing AP up..."
sudo nmcli con up "$AP_NAME" ifname "$IFACE"

# Give NM a moment to assign IP and start dnsmasq
sleep 1

# ----- 3. Print status -----
echo
echo "===== AP STATUS ====="
if nmcli -t -f NAME,DEVICE con show --active | grep -q "^${AP_NAME}:${IFACE}$"; then
    echo "[+] AP $AP_NAME is ACTIVE on $IFACE"
    ip -4 addr show "$IFACE" | grep -w inet || true
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