from machine import Pin
import time


class DRV8825:
    """
    DRV8825 stepper driver for ESP32-C3 Super Mini.
    Handles: enable/disable, microstepping, acceleration ramp,
             angle-based moves, and non-blocking step counting.

    Wiring (Prismo test stand):
        STEP -> GPIO 3
        DIR  -> GPIO 4
        EN   -> GPIO 5
        M0   -> GND  (open)
        M1   -> GND  (open)
        M2   -> 3.3V   => 1/16 microstepping
        RST  -> SLP  (bridged)
    """

    # M0/M1/M2 pin states for each mode (for reference — set in hardware)
    MICROSTEP_TABLE = {
        1:  (0, 0, 0),   # full step
        2:  (1, 0, 0),   # half
        4:  (0, 1, 0),   # 1/4
        8:  (1, 1, 0),   # 1/8
        16: (0, 0, 1),   # 1/16
        32: (1, 1, 1),   # 1/32
    }

    def __init__(
        self,
        step_pin,
        dir_pin,
        en_pin,
        microsteps=16,
        steps_per_rev=200,
        speed_rpm=60,
        accel_steps=100,
    ):
        self._step = Pin(step_pin, Pin.OUT)
        self._dir  = Pin(dir_pin,  Pin.OUT)
        self._en   = Pin(en_pin,   Pin.OUT)

        self.microsteps    = microsteps
        self.steps_per_rev = steps_per_rev * microsteps   # full steps * microsteps
        self.accel_steps   = accel_steps  # ramp length in microsteps

        self._step.value(0)
        self._dir.value(0)
        self.disable()

        self.set_speed(speed_rpm)

        # position tracking (in microsteps)
        self._position = 0

    # ── speed ──────────────────────────────────────────────────────────────
    def set_speed(self, rpm):
        """Set target speed in RPM. Minimum ~1 RPM."""
        rpm = max(1, rpm)
        steps_per_sec = (self.steps_per_rev * rpm) / 60
        self._min_delay_us = int(500_000 / steps_per_sec)  # half-period in µs
        self._max_delay_us = self._min_delay_us * 8        # slow start for ramp

    # ── enable / disable ──────────────────────────────────────────────────
    def enable(self):
        """Activate driver (EN active LOW)."""
        self._en.value(0)
        time.sleep_ms(1)

    def disable(self):
        """De-energise coils — saves power and reduces heat."""
        self._en.value(1)

    # ── low-level single step ──────────────────────────────────────────────
    def _do_step(self, delay_us):
        self._step.value(1)
        time.sleep_us(delay_us)
        self._step.value(0)
        time.sleep_us(delay_us)

    # ── motion ────────────────────────────────────────────────────────────
    def rotate(self, steps, clockwise=True, auto_disable=True):
        """
        Rotate a number of microsteps with acceleration ramp.

        steps        -- microsteps to move
        clockwise    -- direction
        auto_disable -- de-energise coils after move (reduces heat)
        """
        if steps <= 0:
            return

        self._dir.value(1 if clockwise else 0)
        time.sleep_us(2)   # DIR setup time
        self.enable()

        ramp = min(self.accel_steps, steps // 2)
        delay_range = self._max_delay_us - self._min_delay_us

        for i in range(steps):
            # acceleration ramp up
            if i < ramp:
                delay = self._max_delay_us - int(delay_range * i / ramp)
            # deceleration ramp down
            elif i >= steps - ramp:
                remaining = steps - i
                delay = self._max_delay_us - int(delay_range * remaining / ramp)
            # constant speed
            else:
                delay = self._min_delay_us

            self._do_step(delay)

            # track position
            self._position += 1 if clockwise else -1

        if auto_disable:
            self.disable()

    def rotate_degrees(self, degrees, clockwise=True, auto_disable=True):
        """Rotate by angle in degrees."""
        steps = int(self.steps_per_rev * degrees / 360)
        self.rotate(steps, clockwise, auto_disable)

    def rotate_revolutions(self, revolutions, clockwise=True, auto_disable=True):
        """Rotate by number of full revolutions."""
        steps = int(self.steps_per_rev * revolutions)
        self.rotate(steps, clockwise, auto_disable)

    def rotate_to_angle(self, target_degrees, clockwise=True, auto_disable=True):
        """
        Rotate to an absolute angle (0–360).
        Useful for positioning the NFC tag disk to a specific slot.
        """
        target_steps = int(self.steps_per_rev * (target_degrees % 360) / 360)
        current_steps = self._position % self.steps_per_rev
        delta = (target_steps - current_steps) % self.steps_per_rev
        if delta == 0:
            return
        self.rotate(delta, clockwise, auto_disable)

    # ── position ──────────────────────────────────────────────────────────
    def reset_position(self):
        """Zero the position counter (call after homing)."""
        self._position = 0

    @property
    def position_degrees(self):
        """Current position in degrees (wraps 0–360)."""
        angle = (self._position % self.steps_per_rev) * 360 / self.steps_per_rev
        return round(angle, 1)

    def __repr__(self):
        return (
            f"DRV8825(microsteps={self.microsteps}, "
            f"steps_per_rev={self.steps_per_rev}, "
            f"pos={self.position_degrees}°)"
        )
