# tmp-emulate-tag

Minimal standalone firmware that turns a PN532 into a **passive ISO14443-A tag
emulator**.

## Is tag emulation possible with the PN532?

Yes, partially. Limitations to be aware of:

- It emulates the **anticollision + UID** layer only. It does **not** fully
  emulate a MiFare Classic with authenticated/readable sectors.
- In target mode the NFCID1 is 3 bytes. The reader sees a **4-byte UID**:
  `0x08` (the "random UID" cascade tag) followed by your 3 bytes. So with the
  `EMULATED_UID = 12 34 56`, a reader reports `08123456`.

## Files

- `PN532.py` — SPI driver (copied from `firmware/libs/PN532.py`, plus a
  `tg_init_as_target()` method added for emulation).
- `main.py` — initializes SPI + PN532 and loops in target mode.

## Wiring (Prismo pin map)

| PN532 | ESP32-C3 GPIO |
|-------|---------------|
| SCK   | 4             |
| MISO  | 5             |
| MOSI  | 6             |
| SS    | 7             |

## Configure the emulated UID

Edit `EMULATED_UID` in `main.py` (3 bytes).

## Run

```sh
mpremote connect <PORT> cp PN532.py : + cp main.py : + run main.py
```

