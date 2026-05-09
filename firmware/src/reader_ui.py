import utime
from src import config
from src import color
from src import buzzer
from machine import Pin

class ReaderUI:
    def __init__(self):
        self.success_pin = Pin(config.PIN_OUTPUT_SUCESS, Pin.OUT)
        self.error_pin = Pin(config.PIN_OUTPUT_ERROR, Pin.OUT)
        self.machine_active = False
        self.active_uid = None

        self.success_pin.off()
        self.error_pin.off()

    def show_configuration_save(self):
        color.set_sub_light_color(0x00FF00)
        buzzer.play_success_sound()

    def reset(self):
        self.success_pin.off()
        self.error_pin.off()

    def ready_to_read(self):
        color.set_sub_light_color(0x800080)
        buzzer.turn_off()

    def success(self):
        color.set_sub_light_color(0x00FF00)
        self.success_pin.on()
        buzzer.play_success_sound()

        utime.sleep_ms(config.SUCCESS_SIGNAL_DURATION)
        self.success_pin.off()
        self.ready_to_read()

    def error(self):
        self.error_pin.on()
        color.set_sub_light_color(0xFF0000)
        buzzer.play_error_sound()

        utime.sleep_ms(config.ERROR_SIGNAL_DURATION)
        self.error_pin.off()

        self.ready_to_read()

    def machine_toggle(self, uid):
        if self.machine_active:
            if self.active_uid == uid:
                self.machine_active = False
                self.active_uid = None
                self.success_pin.off()
                buzzer.play_success_sound()
                self.ready_to_read()
            else:
                self.error()
        else:
            self.machine_active = True
            self.active_uid = uid
            self.success_pin.on()
            color.set_sub_light_color(0x00FF00)
            buzzer.play_success_sound()

    def machine_on(self):
        self.machine_active = True
        self.success_pin.on()
        color.set_sub_light_color(0x00FF00)
        buzzer.play_success_sound()

    def machine_off(self):
        self.machine_active = False
        self.active_uid = None
        self.success_pin.off()
        buzzer.play_success_sound()
        self.ready_to_read()
