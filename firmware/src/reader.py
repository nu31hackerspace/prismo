import time
import uhashlib
import ubinascii
from machine import SPI, Pin
from src import config
from src import health_log
from libs.PN532 import PN532

# Health flag – read by src.health_log to report NFC hardware status.
# None  = not yet initialised
# True  = PN532 initialised successfully
# False = PN532 init failed
reader_ok = None

def init():
    """Initialize the PN532 reader over SPI. Returns an nfc handle on success,
    or None (with reader_ok=False) if the hardware never comes up. The
    caller owns the polling loop — see read_uid()."""
    global reader_ok
    health_log.write_info("Starting Prismo Reader (SPI)")

    try:
        spi = SPI(1, baudrate=config.NFC_BAUDRATE, polarity=0, phase=0,
                  sck=Pin(config.PIN_NFC_SCK),
                  mosi=Pin(config.PIN_NFC_MOSI),
                  miso=Pin(config.PIN_NFC_MISO))
        health_log.write_info("SPI initialized", spi=str(spi))
    except Exception as e:
        health_log.write_error("Hardware SPI init failed", error=str(e))
        reader_ok = False
        return None

    cs_pin = Pin(config.PIN_NFC_SS, Pin.OUT)
    cs_pin.on()

    health_log.write_info("Initializing PN532")
    _max_retries = 10
    _retries = 0
    while True:
        try:
            nfc = PN532(spi, cs_pin, debug=config.DEBUG)

            time.sleep(0.1)

            ic, ver, rev, support = nfc.get_firmware_version()
            health_log.write_info("PN532 found", fw_version="{}.{}".format(ver, rev))

            nfc.SAM_configuration()
            reader_ok = True
            return nfc
        except Exception as e:
            _retries += 1
            health_log.write_warn("PN532 init failed, retrying", attempt=_retries, error=str(e))
            if _retries >= _max_retries:
                health_log.write_error("PN532 init permanently failed", attempts=_max_retries)
                reader_ok = False
                return None
            time.sleep(1)


def read_uid(nfc, timeout=500):
    """Poll once for a card, blocking up to timeout ms. Returns the card's
    uid hash, or None if no card was present."""
    uid = nfc.read_passive_target(timeout=timeout)
    if uid is None:
        return None
    uid_str = "".join("{:02x}".format(i) for i in uid)
    uid_hash = ubinascii.hexlify(uhashlib.sha256(uid_str).digest()).decode()
    health_log.write_info("Card found", uid_hash=uid_hash)
    return uid_hash
