## The test stand for the prismo project.

### Setup the raspberry pi

#### Symlink the esp32 to ttyESP32C3 device

```sh
root@teststand:/etc/udev/rules.d# cat > /etc/udev/rules.d/99-esp32c3.rules <<'EOF'
> SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", ATTRS{idProduct}=="1001", SYMLINK+="ttyESP32C3", GROUP="dialout", MODE="0666"
EOF
root@teststand:/etc/udev/rules.d# cat 99-
99-esp32c3.rules       99-rpi-keyboard.rules
root@teststand:/etc/udev/rules.d# cat 99-
99-esp32c3.rules       99-rpi-keyboard.rules
root@teststand:/etc/udev/rules.d# cat 99-esp32c3.rules
SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", ATTRS{idProduct}=="1001", SYMLINK+="ttyESP32C3", GROUP="dialout", MODE="0666"
root@teststand:/etc/udev/rules.d# udevadm control --reload-rules
root@teststand:/etc/udev/rules.d# udevadm trigger --action=add --subsystem-match=tty
root@teststand:/etc/udev/rules.d# ls -la /dev/ttyESP32C3
lrwxrwxrwx 1 root root 7 May  7 19:04 /dev/ttyESP32C3 -> ttyACM0
root@teststand:/etc/udev/rules.d#
```


#### Runner lable 

`test-stand`

