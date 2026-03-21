import gc
from src import health_log

health_log.write_info("Booting Prismo")
from src import config
from src import color
from src import buzzer
import utime

gc.enable()

health_log.write_info("Prismo booted")

if not config.QUICK_START:
    health_log.write_info("Start: turn off all")
    color.turn_off_all()
    buzzer.turn_off()

    health_log.write_info("Start: play start animation")
    color.play_start_animation()

    buzzer.play_error_sound()
    utime.sleep_ms(2000)
    buzzer.play_success_sound()
else:
    health_log.write_info("Skip load animation")