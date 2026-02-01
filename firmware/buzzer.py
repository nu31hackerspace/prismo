import utime
import machine

from config import (
    PIN_BUZZER
)

buzzer_pin = machine.Pin(PIN_BUZZER, machine.Pin.OUT)

def turn_on():
    buzzer_pin.value(1)

def turn_off():
    buzzer_pin.value(0)

def play_success_sound():
    turn_on()
    utime.sleep_ms(100)
    turn_off()


def play_error_sound():
    turn_on()
    utime.sleep_ms(200)
    turn_off()
    utime.sleep_ms(200)
    turn_on()
    utime.sleep_ms(200)
    turn_off()
    utime.sleep_ms(200)
    turn_on()
    utime.sleep_ms(200)
    turn_off()


