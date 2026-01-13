import machine

PWM_FREQ = 1000

PIN_RGB_BLUE = 4
PIN_RGB_GREEN = 3
PIN_RGB_RED = 2

PIN_MAIN_RED = 20
PIN_MAIN_GREEN = 21

PIN_BUZZER = 12

_red_pin = machine.Pin(PIN_RGB_RED)
_green_pin = machine.Pin(PIN_RGB_GREEN)
_blue_pin = machine.Pin(PIN_RGB_BLUE)

red_pwm = machine.PWM(_red_pin, freq=PWM_FREQ, duty_u16=0)
green_pwm = machine.PWM(_green_pin, freq=PWM_FREQ, duty_u16=0)
blue_pwm = machine.PWM(_blue_pin, freq=PWM_FREQ, duty_u16=0)

main_diode_red_pin = machine.Pin(PIN_MAIN_RED, machine.Pin.OUT)
main_diode_green_pin = machine.Pin(PIN_MAIN_GREEN, machine.Pin.OUT)

buzzer_pin = machine.Pin(PIN_BUZZER, machine.Pin.OUT)

