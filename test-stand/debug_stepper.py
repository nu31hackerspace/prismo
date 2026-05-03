"""
Minimal stepper debug — bypasses DRV8825 class to isolate the issue.
Run with: import debug_stepper
"""
from machine import Pin
import time

step = Pin(3, Pin.OUT)
dir_ = Pin(4, Pin.OUT)
en   = Pin(5, Pin.OUT)

step.value(0)
dir_.value(0)

print("--- Step 1: Enable driver (EN=LOW) ---")
en.value(0)
time.sleep_ms(5)

print("--- Step 2: 200 raw steps CW (full-step speed) ---")
dir_.value(1)
time.sleep_us(5)

for i in range(200):
    step.value(1)
    time.sleep_ms(5)
    step.value(0)
    time.sleep_ms(5)
    if i % 50 == 0:
        print(f"  step {i}")

print("--- Step 3: Disable driver ---")
en.value(1)
print("Done. Did the motor move?")
