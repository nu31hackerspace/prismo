import machine

PWM_FREQ = 1000

PIN_RGB_BLUE = 2
PIN_RGB_GREEN = 1
PIN_RGB_RED = 0

PIN_MAIN_RED = 8
PIN_MAIN_GREEN = 9

PIN_BUZZER = 10
PIN_RELAY = 21

PIN_NFC_SCK = 4
PIN_NFC_MOSI = 6
PIN_NFC_SS = 7
PIN_NFC_MISO = 5
PIN_NFC_RESET = 3

_red_pin = machine.Pin(PIN_RGB_RED)
_green_pin = machine.Pin(PIN_RGB_GREEN)
_blue_pin = machine.Pin(PIN_RGB_BLUE)

red_pwm = machine.PWM(_red_pin, freq=PWM_FREQ, duty_u16=0)
green_pwm = machine.PWM(_green_pin, freq=PWM_FREQ, duty_u16=0)
blue_pwm = machine.PWM(_blue_pin, freq=PWM_FREQ, duty_u16=0)

main_diode_red_pin = machine.Pin(PIN_MAIN_RED, machine.Pin.OUT)
main_diode_green_pin = machine.Pin(PIN_MAIN_GREEN, machine.Pin.OUT)

buzzer_pin = machine.Pin(PIN_BUZZER, machine.Pin.OUT)
