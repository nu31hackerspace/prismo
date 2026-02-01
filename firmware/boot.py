import gc
print("Booting Prismo...")
import config
import color
import buzzer

gc.enable()

if not config.QUICK_START:
    print('[Start] turn off all')
    color.turn_off_all()
    buzzer.turn_off()

    print('[Start] play start checkers')
    color.play_start_animation()

    buzzer.play_success_sound()
else:
    print('Skip load animation')