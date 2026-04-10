import time
import utime
import machine
from machine import SPI, Pin, WDT
from src import config
from src import health_log
from libs.PN532 import PN532

# Health flag – read by src.health_log to report NFC hardware status.
# None  = not yet initialised
# True  = PN532 initialised successfully
# False = PN532 init failed
reader_ok = None

def subscribe(callback, mqtt_manager=None):
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
        return
    
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
            break
        except Exception as e:
            _retries += 1
            health_log.write_warn("PN532 init failed, retrying", attempt=_retries, error=str(e))
            if _retries >= _max_retries:
                health_log.write_error("PN532 init permanently failed", attempts=_max_retries)
                reader_ok = False
                return
            time.sleep(1)

    health_log.write_info("Waiting for RFID/NFC card")
    wdt = WDT(timeout=8000)
    _last_log_ms = utime.ticks_ms()
    while True:
        uid = nfc.read_passive_target(timeout=500)
        wdt.feed()
        if mqtt_manager:
            mqtt_manager.maintain()

        if uid is not None:
             health_log.write_info("Card found", uid=[hex(i) for i in uid])
             if callback:
                 uid_str = "".join("{:02x}".format(i) for i in uid)
                 callback(uid_str)
             time.sleep(1)

        now = utime.ticks_ms()
        if utime.ticks_diff(now, _last_log_ms) >= 60_000:
            health_log.write_log()
            _last_log_ms = now
