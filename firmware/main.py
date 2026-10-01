from src import serial_cfg

serial_cfg.start()
try:
    import src.prismo_main
finally:
    serial_cfg.stop()
