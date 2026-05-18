import sys
from worker import build_firmware

ssid, password, mqtt_user, mqtt_pass, mode, out = sys.argv[1:7]
with open(out, 'wb') as f:
    f.write(build_firmware(ssid, password, mqtt_user, mqtt_pass, mode))
