import time
import machine
from machine import SPI, Pin
from src import config
from libs.PN532 import PN532

def subscribe(callback):
    print("Starting Prismo Reader (SPI)...")
    
    try:
        spi = SPI(1, baudrate=config.NFC_BAUDRATE, polarity=0, phase=0, 
                  sck=Pin(config.PIN_NFC_SCK), 
                  mosi=Pin(config.PIN_NFC_MOSI), 
                  miso=Pin(config.PIN_NFC_MISO))
        print(f"SPI Initialized: {spi}")
    except Exception as e:
        print("Hardware SPI init failed:", e)
        return
    
    cs_pin = Pin(config.PIN_NFC_SS, Pin.OUT)
    cs_pin.on()

    print("Initializing PN532...")
    while True:
        try:
            nfc = PN532(spi, cs_pin, debug=config.DEBUG)
            
            time.sleep(0.1)
            
            ic, ver, rev, support = nfc.get_firmware_version()
            print("Found PN532 with firmware version: {0}.{1}".format(ver, rev))
            
            nfc.SAM_configuration()
            break
        except Exception as e:
            print("Cannot init PN532 due to:", e)
            print("Retrying...")
            time.sleep(1)

    print("Waiting for RFID/NFC card...")
    while True:
        uid = nfc.read_passive_target(timeout=500)
        
        if uid is not None:
             print("Found card with UID:", [hex(i) for i in uid])
             if callback:
                 uid_str = "".join("{:02x}".format(i) for i in uid)
                 callback(uid_str)
             time.sleep(1) 
        else:
             pass
        
        time.sleep(0.1)
