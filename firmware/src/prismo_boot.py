import gc
print("Booting Prismo...")
from src import config
from src import color
from src import buzzer
import utime

gc.enable()

print('Prismo booted')

if not config.QUICK_START:
    print('[Start] turn off all')
    color.turn_off_all()
    buzzer.turn_off()

    print('[Start] play start checkers')
    color.play_start_animation()

    buzzer.play_error_sound()
    utime.sleep_ms(2000)
    buzzer.play_success_sound()
else:
    print('Skip load animation')