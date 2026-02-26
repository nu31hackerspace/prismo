# Prismo – a simple access module

Prismo is a simple device that lets you control access to a door or machine using an NFC/RFID card.

You can use it, for example, to:
- Open a door only with a valid card
- Turn on a machine only for authorized users

## Why are we making Prismo?

We started Prismo because we could not find a simple, low‑cost project that:
- Uses easy hardware
- Uses simple, free software
- Is friendly for beginners

Before building more features, we wrote down what we want from this project.

### General requirements

- You do not need special knowledge to build and use Prismo.
- You do not need any paid software. Everything needed is free.

### Hardware requirements

- The PCB is single‑layer, so it can be made with CNC or a simple toner‑transfer / laser–iron method.
- It should be good as a first soldering project.
- All components should be easy to solder.(We still need to define how to measure “easy to solder”.)
- You do not need special tools to solder or assemble the device.
- All parts should be off‑the‑shelf, easy to buy in common electronics shops.
- The total cost of the device should be low.

### Software requirements
- It should be easy to connect Prismo to other systems (for example, a home automation system or a custom app).
- Users should be able to move away from Prismo to another solution without problems.
- The project should use a common programming language that:
- Many developers already know
- Is easy to understand
- Works well with AI tools

## Project structure
The repository is a monorepo. That means all components of the project live in one place.

- `firmware/` – the software that runs on the Prismo device.This folder has its own README.md.
- `hardware/` – the hardware design files, such as KiCad schematics and PCB layout.

## Project CI
The projec use github action as CI, the Ci build the '*.bin' file for the firmware. 

## The project stage
⚠️⚠️⚠️ The project is in a pre-release stage, so any APIs or contracts may change in the future. Use the current version of the project at your own risk.
