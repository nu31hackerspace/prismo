import time
import machine
from machine import SPI, Pin
import config
from PN532 import PN532

def run():
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

    # Chip Select Pin
    cs_pin = Pin(config.PIN_NFC_SS, Pin.OUT)
    cs_pin.on()

    # Hardware Reset (RSTPD_N)
    # The PN532 needs to be reset to ensure it's in a known state.
    # Pulse Low for > 100ns, then High. We use 100ms/500ms to be safe.
    if hasattr(config, 'PIN_NFC_RESET'):
        print("Performing Hard Reset...")
        rst_pin = Pin(config.PIN_NFC_RESET, Pin.OUT)
        rst_pin.off()
        time.sleep(0.1)
        rst_pin.on()
        time.sleep(0.5)

    # Initialize PN532 with retry loop
    print("Initializing PN532...")
    while True:
        try:
            # Re-instantiate each time to ensure fresh state
            nfc = PN532(spi, cs_pin, debug=config.DEBUG)
            
            # Additional wake-up/stabilization delay
            time.sleep(0.1)
            
            # Attempt to get firmware version to verify connection
            ic, ver, rev, support = nfc.get_firmware_version()
            print("Found PN532 with firmware version: {0}.{1}".format(ver, rev))
            
            # Configure SAM to read RFID tags
            nfc.SAM_configuration()
            break
        except Exception as e:
            print("Cannot init PN532 due to:", e)
            print("Retrying...")
            time.sleep(1)

    print("Waiting for RFID/NFC card...")
    while True:
        # Check if a card is available to read
        uid = nfc.read_passive_target(timeout=500)
        
        if uid is not None:
             print("Found card with UID:", [hex(i) for i in uid])
             # Setup simple visual feedback or buzzer if needed here
             time.sleep(1) # Prevent spamming readings
        else:
             # No card found
             pass
        
        time.sleep(0.1)
