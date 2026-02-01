import utime
import config
import color
import buzzer
from machine import Pin

class ReaderUI:
    def __init__(self):
        self.mode = config.DEVICE_MODE
        self.success_pin = Pin(config.PIN_OUTPUT_SUCESS, Pin.OUT)
        self.error_pin = Pin(config.PIN_OUTPUT_ERROR, Pin.OUT)
        self.machine_active = False

    def ap_mode(self):
        buzzer.play_success_sound()
        color.set_sub_light_color(0x0000FF)

    def show_configuration_save(self):
        color.set_sub_light_color(0x00FF00)
        buzzer.play_success_sound()

    def ready_to_read(self):
        color.set_sub_light_color(0x800080)

    def success(self):
        color.set_sub_light_color(0x000000)
        if self.mode == 'ACCESS':
            self._handle_access_success()
            self.ready_to_read()
        elif self.mode == 'MACHINE':
            self._handle_machine_success()

    def error(self):
        buzzer.play_error_sound()
        color.main_diode_show_error()
        
        self.error_pin.on()
        utime.sleep_ms(config.ERROR_SIGNAL_DURATION)
        self.error_pin.off()

    def _handle_access_success(self):
        buzzer.play_success_sound()
        
        self.success_pin.on()
        utime.sleep_ms(config.SUCCESS_SIGNAL_DURATION)
        self.success_pin.off()
        

    def _handle_machine_success(self):
        if self.machine_active:
            self.machine_active = False
            self.success_pin.off()
            buzzer.play_success_sound() 
        else:
            self.machine_active = True
            buzzer.play_success_sound()
            self.success_pin.on()
