import serial
import time

try:
    ser = serial.Serial('/dev/cu.usbmodem1101', 115200, timeout=1)
    # Reset board
    ser.setDTR(False)
    ser.setRTS(False)
    time.sleep(0.1)
    ser.setDTR(True)
    ser.setRTS(True)
    time.sleep(0.1)
    ser.setDTR(False)
    ser.setRTS(False)

    print("--- Reading from serial port ---")
    start = time.time()
    while time.time() - start < 3:
        if ser.in_waiting:
            print(ser.read(ser.in_waiting).decode('utf-8', errors='replace'), end='')
        time.sleep(0.1)
    
    # Check VFS by sending commands
    ser.write(b'\r\n')
    time.sleep(0.1)
    ser.write(b'import os; print(os.listdir())\r\n')
    time.sleep(0.5)
    if ser.in_waiting:
        print(ser.read(ser.in_waiting).decode('utf-8', errors='replace'), end='')

    ser.close()
except Exception as e:
    print(f"Error: {e}")
