# Solder Prismo PCB instruction

This guide is for the **Prismo 1.0.0-RC.2** board. Check the version printed on the bottom edge of the PCB.

[BOM file](https://docs.google.com/spreadsheets/d/12qys1HxDHsoDdR1gj1rnD1MEdx9XqdHl3aNJ3M6xwPU/)

## 1. Main components

### Step 1.1

Insert the pin headers for the ESP32-C3 Super Mini into the front side of the Prismo PCB (the side with the `ESP32-C3 SuperMini` outline) and solder them from the back.

![Step 1.1](step_11.jpg)

### Step 1.2

Put the ESP32-C3 Super Mini on the headers with the USB-C connector facing the `USB` mark on the PCB, then solder it.

![Step 1.2](step_12.jpg)

### Step 1.3

Solder the 8-pin female socket for the PN532 module next to the ESP32 board.

![Step 1.3](step_13.jpg)

At this point, you have soldered all the components required for a working device, **but we recommend adding the light and sound features for a better user experience**.

## 2. Sound - add buzzer

The board has a small buzzer for sound effects. This step is optional, but sound makes the device much nicer to use.

### Step 2.1

Solder an **active buzzer (without a built-in generator)**. Mind the polarity: the `+` leg of the buzzer goes to the `+` pad on the PCB.

![Step 2.1](step_21.jpg)

### Step 2.2

Solder the **100 Ω** resistor marked `100`. The resistor sets the buzzer volume: a bigger resistor makes it quieter (with 1000 Ω you can hear it only in a completely silent room).

![Step 2.2](step_22.jpg)

## 3. Light

The light uses four addressable LEDs connected in a chain.

### Step 3.1

Solder four **WS2812 LEDs in the DIP (through-hole) package** into the round footprints in the corners. Each LED has 4 legs, and the longest leg is GND. Each LED footprint has a small triangle that points to the GND hole, so put the longest leg into the hole the triangle points to.

![Step 3.1](step_31.jpg)

### Step 3.2 (optional)

All capacitors are optional. The board has footprints for two electrolytic capacitors (round outlines with `+`) on the power line and small footprints next to each LED. Mind the polarity of the electrolytic capacitors: the long leg goes to `+`.

![Step 3.2](step_32.jpg)

## 4. Power and output connector

The `SIG` / `GND` / `+5V` header is used to connect an external power supply and an external relay or transistor:

- `+5V` and `GND` - 5 V power supply input (when the device is not powered through USB-C).
- `SIG` - output on GPIO 20. It goes high when a key is accepted; use it to drive a relay module or a transistor (for example, a door lock).

You decide what to solder here, depending on how you connect the device: a JST connector, pin headers, a screw terminal, or wires soldered straight to the board. You can also leave it empty if you power the device through USB-C and don't need the output.

- Pitch (distance between holes): 2.54 mm. Standard pin headers and 2.54 mm connectors fit, and so do JST-XH (2.50 mm) connectors.
- Hole diameter: 0.95 mm.
- The square pad is `+5V`.

The header has two identical rows; the matching pins of both rows are connected together. The second row is there for special cases, for example when you need an extra `+5V` and `GND` to power a relay module. Using only one row is totally OK.

## 5. PN532 module

### Step 5.1

Solder the male pins to the PN532 module.

![Step 5.1](step_40.jpg)

Congrats, you've finished the soldering part! Now you can visit our [web app](https://prismo.nu31.space/) to flash your board.

## 6. Assembly

### Step 6.1

Add two heat inserts into the 3D printed housing and add the diffuser; use glue for permanent attachment.

![Step 6.1](step_51.jpg)

### Step 6.2

Attach the PN532 using two PCB standoffs.

![Step 6.2](step_52.jpg)

### Step 6.3

Add the main PCB and fix it with two M3 bolts.

![Step 6.3](step_53.jpg)

## Result

![Assembled Prismo device](result.jpg)
