"""Minimal PN532 passive-tag emulator firmware.

Puts the PN532 into ISO14443-A target (card emulation) mode so an external
reader -- e.g. the ../tmp-just-read board -- detects it as a passive NFC tag
and reads the UID below. No WiFi, buzzer, LED or MQTT.

Wiring matches the Prismo pin map (see firmware/src/config.py):
    SCK  -> GPIO 4
    MISO -> GPIO 5
    MOSI -> GPIO 6
    SS   -> GPIO 7

Note: the PN532 can emulate the tag's anticollision + UID, but NOT a full
MiFare Classic with authenticated sectors. A reader will see a 4-byte UID:
0x08 followed by the 3 bytes of EMULATED_UID below.
"""
import time
import os
from machine import SPI, Pin
from PN532 import PN532

# --- Pin / bus config (from firmware/src/config.py) -------------------------
NFC_BAUDRATE = 1_000_000
PIN_NFC_SCK = 4
PIN_NFC_MISO = 5
PIN_NFC_MOSI = 6
PIN_NFC_SS = 7

# 3-byte NFCID1 presented to the reader (reader sees 0x08 + these bytes).
# Re-randomised every UID_ROTATE_MS so the reader sees a fresh tag.
UID_ROTATE_MS = 5000


def random_uid():
    """Return a fresh random 3-byte NFCID1."""
    return os.urandom(3)


def main():
    print("Starting PN532 passive-tag emulator")

    spi = SPI(1, baudrate=NFC_BAUDRATE, polarity=0, phase=0,
              sck=Pin(PIN_NFC_SCK),
              mosi=Pin(PIN_NFC_MOSI),
              miso=Pin(PIN_NFC_MISO))

    cs_pin = Pin(PIN_NFC_SS, Pin.OUT)
    cs_pin.on()

    # Init PN532, retrying until it answers.
    while True:
        try:
            nfc = PN532(spi, cs_pin, debug=False)
            ic, ver, rev, support = nfc.get_firmware_version()
            print("PN532 found, firmware {}.{}".format(ver, rev))
            nfc.SAM_configuration()
            break
        except Exception as e:
            print("PN532 init failed, retrying:", e)
            time.sleep(1)

    uid = random_uid()
    last_rotate = time.ticks_ms()
    uid_str = "".join("{:02x}".format(b) for b in uid)
    print("Emulating passive tag, NFCID1:", uid_str, "(reader sees 08" + uid_str + ")")

    while True:
        # Rotate to a fresh random UID every UID_ROTATE_MS.
        if time.ticks_diff(time.ticks_ms(), last_rotate) >= UID_ROTATE_MS:
            uid = random_uid()
            last_rotate = time.ticks_ms()
            uid_str = "".join("{:02x}".format(b) for b in uid)
            print("New NFCID1:", uid_str, "(reader sees 08" + uid_str + ")")

        # Blocks until a reader activates us, or times out; then loop to keep
        # presenting the tag.
        activated = nfc.tg_init_as_target(uid, timeout=2000)
        if activated is not None:
            print("Activated by an external reader")
            time.sleep(0.5)


main()
