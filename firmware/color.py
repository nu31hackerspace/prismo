import utime
import machine

from config import (
    PWM_FREQ,
    PIN_RGB_RED,
    PIN_RGB_GREEN,
    PIN_RGB_BLUE,
)

MAX_BRIGHTNESS = 255

_red_pin = machine.Pin(PIN_RGB_RED)
_green_pin = machine.Pin(PIN_RGB_GREEN)
_blue_pin = machine.Pin(PIN_RGB_BLUE)

red_pwm = machine.PWM(_red_pin, freq=PWM_FREQ, duty_u16=0)
green_pwm = machine.PWM(_green_pin, freq=PWM_FREQ, duty_u16=0)
blue_pwm = machine.PWM(_blue_pin, freq=PWM_FREQ, duty_u16=0)

def set_sub_light_color(hex_int):
    r = (hex_int >> 16) & 0xFF
    g = (hex_int >> 8) & 0xFF
    b = hex_int & 0xFF
    
    red_pwm.duty_u16(r * 257)
    green_pwm.duty_u16(g * 257)
    blue_pwm.duty_u16(b * 257)

def turn_off_all():
    set_sub_light_color(0x000000)

def play_start_animation():
    colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFFFF]
    fade_steps = 15
    step_delay_ms = 15

    for target_hex in colors:
        target_r = (target_hex >> 16) & 0xFF
        target_g = (target_hex >> 8) & 0xFF
        target_b = target_hex & 0xFF

        for i in range(fade_steps + 1):
            r = int(target_r * i / fade_steps)
            g = int(target_g * i / fade_steps)
            b = int(target_b * i / fade_steps)
            current_hex = (r << 16) | (g << 8) | b
            set_sub_light_color(current_hex)
            utime.sleep_ms(step_delay_ms)
        
        utime.sleep_ms(100)

        for i in range(fade_steps, -1, -1):
            r = int(target_r * i / fade_steps)
            g = int(target_g * i / fade_steps)
            b = int(target_b * i / fade_steps)
            current_hex = (r << 16) | (g << 8) | b
            set_sub_light_color(current_hex)
            utime.sleep_ms(step_delay_ms)
    
    set_sub_light_color(0x000000)
