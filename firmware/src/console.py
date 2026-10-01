import sys
import _thread

_lock = _thread.allocate_lock()


def write(text):
    with _lock:
        sys.stdout.write(text)
