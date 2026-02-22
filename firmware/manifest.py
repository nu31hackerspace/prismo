# Include standard ESP32 generic manifest
include("$(PORT_DIR)/boards/manifest.py")

# Freeze the root entry-points (boot.py and main.py) so they are embedded in the binary.
# MicroPython checks frozen modules when boot.py / main.py are not found on the VFS,
# so the board will boot and run your code without any files being uploaded.
freeze(".", "boot.py")
freeze(".", "main.py")

# Freeze the libs and src packages (imported by boot.py and main.py above).
# The "." means "look relative to this manifest file". freeze(".", "src") makes
# all files in src/ importable as src.something (preserving the directory as package).
freeze(".", "libs")
freeze(".", "src")