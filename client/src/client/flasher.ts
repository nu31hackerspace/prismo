import { ESPLoader, Transport } from "esptool-js";

export async function flashAndConfigure(
  port: SerialPort,
  firmwareUrl: string,
  config: object,
  onProgress: (msg: string) => void
) {
  onProgress("Connecting to ESP32...");

  const transport = new Transport(port, true);
  const loader = new ESPLoader({
    transport,
    baudrate: 460800,
    terminal: { clean: () => {}, writeLine: onProgress } as any
  });

  await loader.main();

  onProgress("Downloading firmware...");
  const fwResponse = await fetch(firmwareUrl);
  const fwArrayBuffer = await fwResponse.arrayBuffer();

  onProgress("Flashing firmware...");
  await loader.writeFlash({
    fileArray: [{ data: new Uint8Array(fwArrayBuffer), address: 0x0 }],
    flashSize: "keep", flashMode: "keep", flashFreq: "keep",
    eraseAll: false,
    compress: true,
    reportProgress: (fileIndex: any, written: any, total: any) => {
      onProgress(`Flashing... ${Math.round((written / total) * 100)}%`);
    }
  });

  onProgress("Firmware flashed! Configuring device...");

  // Hard reset to boot MicroPython
  await transport.setDTR(false);
  await transport.setRTS(true);
  await new Promise(r => setTimeout(r, 100));
  await transport.setDTR(true);
  await transport.setRTS(false);
  await new Promise(r => setTimeout(r, 50));
  await transport.setDTR(false);

  // Wait for boot
  await new Promise(r => setTimeout(r, 2000));

  // Write config via raw REPL
  onProgress("Writing configuration...");
  const writer = transport.device.writable!.getWriter();

  // Enter raw REPL
  await writer.write(new Uint8Array([3, 1])); // Ctrl-C, Ctrl-A
  await new Promise(r => setTimeout(r, 500));

  const configScript = `
import json
try:
    with open('config.json', 'w') as f:
        json.dump(${JSON.stringify(config)}, f)
    print("CONFIG_OK")
except Exception as e:
    print("CONFIG_ERROR:", e)
`;

  const encoder = new TextEncoder();
  await writer.write(encoder.encode(configScript));
  await writer.write(new Uint8Array([4])); // Ctrl-D to execute

  await new Promise(r => setTimeout(r, 1000));

  // Exit raw REPL and reboot
  await writer.write(new Uint8Array([2, 4])); // Ctrl-B, Ctrl-D
  writer.releaseLock();

  onProgress("Configuration saved! Device is restarting.");
}

export async function readDeviceState(port: SerialPort): Promise<any> {
  const transport = new Transport(port, true);
  await transport.connect();

  const writer = transport.device.writable!.getWriter();

  // Interrupt and enter raw REPL
  await writer.write(new Uint8Array([3, 1])); // Ctrl-C, Ctrl-A
  await new Promise(r => setTimeout(r, 500));

  const stateScript = `
import json
try:
    from src import health_log
    print("===STATE_START===")
    print(json.dumps(health_log.collect()))
    print("===STATE_END===")
except Exception as e:
    print("STATE_ERROR:", e)
`;

  const encoder = new TextEncoder();
  await writer.write(encoder.encode(stateScript));
  await writer.write(new Uint8Array([4])); // Ctrl-D to execute

  // We need to read the output to get the state JSON
  const reader = transport.device.readable!.getReader();
  const decoder = new TextDecoder();
  let output = "";

  try {
    for (let i = 0; i < 20; i++) { // wait up to ~2 seconds
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<{value: any, done: boolean}>(r => setTimeout(() => r({value: undefined, done: true}), 100))
      ]);
      if (value) {
        output += decoder.decode(value);
      }
      if (output.includes("===STATE_END===")) break;
    }
  } finally {
    reader.releaseLock();
  }

  // Resume normal execution
  await writer.write(new Uint8Array([2, 4])); // Ctrl-B, Ctrl-D
  writer.releaseLock();
  await transport.disconnect();

  const match = output.match(/===STATE_START===\r?\n(.*)\r?\n===STATE_END===/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error("Failed to parse state json", match[1]);
    }
  }
  return null;
}
