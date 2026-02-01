import utime
from machine import Pin, PWM
from config import PIN_BUZZER

NOTES = {
    'C4': 262, 'D4': 294, 'E4': 330, 'F4': 349, 'G4': 392, 'A4': 440, 'B4': 494,
    'C5': 523, 'D5': 587, 'E5': 659, 'F5': 698, 'G5': 784, 'A5': 880, 'B5': 988,
    'C6': 1047, 'D6': 1175, 'E6': 1319, 'F6': 1397, 'G6': 1568, 'A6': 1760,
    'OFF': 0
}

_buzzer = PWM(Pin(PIN_BUZZER))
_buzzer.duty(0)

def _play_tone(note_name, duration_ms):
    freq = NOTES.get(note_name, 0)
    
    if freq > 0:
        _buzzer.freq(freq)
        _buzzer.duty(512)
    else:
        _buzzer.duty(0)
        
    utime.sleep_ms(duration_ms)
    _buzzer.duty(0)

def play_success_sound():
    _play_tone('C6', 100)
    utime.sleep_ms(30)
    _play_tone('G6', 150)

def play_error_sound():
    _play_tone('A4', 200)
    utime.sleep_ms(50)
    _play_tone('E4', 400)
    
def turn_off():
    _buzzer.duty(0)

def deinit():
    _buzzer.deinit()