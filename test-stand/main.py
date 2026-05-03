"""
Prismo test stand — stepper first-run demo
ESP32-C3 Super Mini + DRV8825 + NEMA17 JK42HS40-1704
 
Wiring:
    GPIO 3 -> STEP    GPIO 4 -> DIR    GPIO 5 -> EN
    M2 -> 3.3V  (M0/M1 open)  =>  1/16 microstep
    RST bridged to SLP
    12V 2A PSU to VMOT/GND
"""
 
from stepper import DRV8825
import time
 
motor = DRV8825(
    step_pin=3,
    dir_pin=4,
    en_pin=5,
    microsteps=16,       # matches M2=3.3V hardware
    steps_per_rev=200,   # NEMA17 1.8 deg/step
    speed_rpm=60,        # start gentle
    accel_steps=100,     # ramp over 100 microsteps
)
 
print(motor)
print("Starting test sequence...")
 
while True:
    print("1 rev CW  at 60 RPM")
    motor.rotate_revolutions(1, clockwise=True)
    time.sleep_ms(500)
 
    print("1 rev CCW at 60 RPM")
    motor.rotate_revolutions(1, clockwise=False)
    time.sleep_ms(500)
 
    # demo: position-based move (useful for NFC tag disk)
    print(f"Position: {motor.position_degrees} deg")
    motor.set_speed(30)
    motor.rotate_degrees(120, clockwise=True)   # 1/3 turn
    print(f"After 120 deg move: {motor.position_degrees} deg")
    time.sleep_ms(500)
 
    motor.set_speed(60)
    time.sleep(1)
 