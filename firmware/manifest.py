# Include the default ESP32-C3 board manifest
include("$(PORT_DIR)/boards/manifest.py")

# Freeze our custom firmware directory
freeze(".")
