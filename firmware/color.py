import utime

from hardware_config import (
    red_pwm, green_pwm, blue_pwm,
    main_diode_red_pin, main_diode_green_pin
)

MAX_BRIGHTNESS = 255

def _set_sub_light_color(hex_int):
    r = (hex_int >> 16) & 0xFF
    g = (hex_int >> 8) & 0xFF
    b = hex_int & 0xFF
    
    red_pwm.duty_u16(r * 257)
    green_pwm.duty_u16(g * 257)
    blue_pwm.duty_u16(b * 257)

def _control_main_diode(color):
    """
    color: 'RED', 'GREEN', або 'OFF'
    """
    color = color.upper() 

    if color == "RED":
        main_diode_red_pin.value(1)
        main_diode_green_pin.value(0)
        print("Main Diode: RED ON")
    elif color == "GREEN":
        main_diode_red_pin.value(0)
        main_diode_green_pin.value(1)
        print("Main Diode: GREEN ON")
    elif color == "OFF":
        main_diode_red_pin.value(0)
        main_diode_green_pin.value(0)
        print("Main Diode: OFF")
    else:
        print(f"Error: Invalid color '{color}'. Use 'RED', 'GREEN', or 'OFF'.")

def turn_off_all():
    _set_sub_light_color(0x000000)
    _control_main_diode("OFF")

def main_diode_show_success():
    _control_main_diode("GREEN")
    utime.sleep(1)
    _control_main_diode("OFF")

def main_diode_show_error():
    _control_main_diode("RED")
    utime.sleep(1)
    _control_main_diode("OFF")

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
            _set_sub_light_color(current_hex)
            utime.sleep_ms(step_delay_ms)
        
        utime.sleep_ms(100)

        for i in range(fade_steps, -1, -1):
            r = int(target_r * i / fade_steps)
            g = int(target_g * i / fade_steps)
            b = int(target_b * i / fade_steps)
            current_hex = (r << 16) | (g << 8) | b
            _set_sub_light_color(current_hex)
            utime.sleep_ms(step_delay_ms)
    
    _set_sub_light_color(0x000000)
