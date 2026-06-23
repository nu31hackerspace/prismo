# Solder prismo PCB instruction

[Bom file](https://docs.google.com/spreadsheets/d/12qys1HxDHsoDdR1gj1rnD1MEdx9XqdHl3aNJ3M6xwPU/)

## Solder main components

### Step 1.1

Solder ESP32-C3 Super mini to Prismo PCB

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_11.jpeg" alt="Step 1.1" height="500">

### Step 1.2

Solder the female pins nearby.

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_12.jpg" alt="Step 1.1" height="500">


_So at the moment you solder all the required components for a working device_, **but we recommend adding the light and sound feature for a better user experience**

## Solder light components

The light line connects to the 5V line and is controlled via 3 transistors. 

### Step 2.1 

Solder three 1kOm resistors to the light board output.

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_21.jpg" alt="Step 1.1" height="500">

### Step 2.2

Solder three BC337 transistors

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_21.jpg" alt="Step 1.1" height="500">


### Step 2.3

Solder four 150 Ω resistors for the red line

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_22.jpg" alt="Step 1.1" height="500">

### Step 2.4

Solder four 100 Ω resistors for the green and blue lines

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_23.jpg" alt="Step 1.1" height="500">

### Step 2.5

Solder four RKGB LED diodes. We use the diodes with a common cathode. Match the long (cathode) pin on the diode with the board GND.

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_24.jpg" alt="Step 1.1" height="500">

## Add buzzer

The board has a small buzzer for sound effects; this step is also optional. The sound enhances the user experience.

### Step 3.1

Solder the resistor for the buzzer. You can control the buzzer's volume by choosing the right resistor. 
Our recommendation is a 510Om. For reference, the 1k resistor makes the buzzer really quiet, so you can hear it only in completely silent environments.

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_31.jpg" alt="Step 1.1" height="500">

### Step 3.2

Solder the buzzer. The positive pin of the buzzer is located near the resistor you solder in step 3.1 

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_32.jpg" alt="Step 1.1" height="500">

## Step 4

Solder the male pins to the PN532 module

<img src="https://github.com/nu31hackerspace/prismo/blob/main/docs/instruction/step_40.jpg" alt="Step 1.1" height="500">

So congrats, you've done the soldering part. Now you can visit our website app to flash your board [here](https://prismo.nu31.space/)






