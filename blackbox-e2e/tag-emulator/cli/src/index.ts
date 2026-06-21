#!/usr/bin/env node
import { Command } from 'commander';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const program = new Command();

program
  .name('tag-emulator')
  .description('CLI to control the Prismo PN532 tag emulator')
  .requiredOption('-p, --port <port>', 'Serial port path (e.g., /dev/tty.usbmodem1101 or /dev/ttyACM0)')
  .requiredOption('-k, --key <hex>', '6-character hex string of the NFC key to simulate (e.g., aabbcc)')
  .requiredOption('-t, --time <seconds>', 'Time in seconds to simulate the key', parseFloat)
  .action((options) => {
    const { port: portPath, key, time } = options;

    if (!/^[0-9a-fA-F]{6}$/.test(key)) {
      console.error("Error: Key must be exactly 6 hex characters.");
      process.exit(1);
    }

    if (isNaN(time) || time <= 0) {
      console.error("Error: Time must be a positive number.");
      process.exit(1);
    }

    console.log(`Connecting to ${portPath}...`);

    const port = new SerialPort({ path: portPath, baudRate: 115200 });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => {
      console.log(`Connected! Offloading emulation task for ${time} seconds to the device...`);
      
      // Give the device a brief moment in case the connection resets it
      setTimeout(() => {
        port.write(`${key}:${time}\n`);
        
        // Wait a tiny bit for the command buffer to flush, then exit immediately
        setTimeout(() => {
          port.close();
          console.log(`Command sent: ${key} for ${time}s. CLI is exiting now; the device will handle the timer.`);
          process.exit(0);
        }, 100);
      }, 500);
    });

    port.on('error', (err) => {
      console.error(`Serial port error: ${err.message}`);
      process.exit(1);
    });

    // Output any responses from the device
    parser.on('data', (data) => {
      if (data.trim() !== '') {
        console.log(`[Device]: ${data}`);
      }
    });
  });

program.parse(process.argv);
