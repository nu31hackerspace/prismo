# Credentials are baked into the firmware at build time.
# The worker replaces these placeholders before compiling.
WIFI_SSID = "{{WIFI_SSID}}"
WIFI_PASS = "{{WIFI_PASS}}"

def get_wifi():
    """Returns (ssid, password) or (None, None) if credentials are not set."""
    if WIFI_SSID and not WIFI_SSID.startswith("{{"):
        return WIFI_SSID, WIFI_PASS
    return None, None

def has_wifi():
    ssid, _ = get_wifi()
    return ssid is not None
