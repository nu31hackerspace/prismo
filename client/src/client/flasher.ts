import { ESPLoader, Transport } from "esptool-js";

export async function flashFirmware(
  port: SerialPort,
  firmwareUrl: string,
  onProgress: (msg: string) => void
): Promise<void> {
  onProgress("Downloading firmware...");
  const fwResponse = await fetch(firmwareUrl);
  if (!fwResponse.ok) throw new Error("Failed to download firmware.");
  const firmware = new Uint8Array(await fwResponse.arrayBuffer());

  onProgress("Connecting to ESP32...");
  const transport = new Transport(port, true);
  const loader = new ESPLoader({
    transport,
    baudrate: 460800,
    terminal: { clean: () => { }, write: () => { }, writeLine: () => { } },
  });

  try {
    await loader.main();
    await loader.writeFlash({
      fileArray: [{ data: firmware, address: 0x0 }],
      flashSize: "keep", flashMode: "keep", flashFreq: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex: number, written: number, total: number) => {
        onProgress(`Flashing... ${Math.round((written / total) * 100)}%`);
      },
    });

    onProgress("Rebooting device...");
    await transport.setRTS(true);
    await new Promise((r) => setTimeout(r, 100));
    await transport.setRTS(false);
  } finally {
    await transport.disconnect();
  }
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
        new Promise<{ value: any, done: boolean }>(r => setTimeout(() => r({ value: undefined, done: true }), 100))
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

/**
 * Read-modify-write an arbitrary set of fields into config.json on an
 * already-provisioned device over USB, without reflashing. Interrupts the
 * running app into the MicroPython raw REPL (same mechanism
 * readDeviceState uses), merges `patch` into the existing
 * config so untouched fields (e.g. allowed_users, credentials not being
 * changed) survive, then soft-resets so the app restarts and picks up the
 * new config immediately.
 */
export async function patchDeviceConfig(
  port: SerialPort,
  patch: Record<string, unknown>,
  onProgress: (msg: string) => void
): Promise<void> {
  const transport = new Transport(port, true);
  await transport.connect();

  const writer = transport.device.writable!.getWriter();
  const reader = transport.device.readable!.getReader();

  try {
    onProgress("Connecting to device...");
    await writer.write(new Uint8Array([3, 1])); // Ctrl-C, Ctrl-A: stop app, enter raw REPL
    await new Promise((r) => setTimeout(r, 500));

    onProgress("Writing configuration...");
    const script = `
import json
try:
    try:
        with open('config.json') as f:
            cfg = json.load(f)
    except Exception:
        cfg = {}
    cfg.update(${JSON.stringify(patch)})
    with open('config.json', 'w') as f:
        json.dump(cfg, f)
    print("CONFIG_OK")
except Exception as e:
    print("CONFIG_ERROR:", e)
`;
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(script));
    await writer.write(new Uint8Array([4])); // Ctrl-D to execute

    const output = await readSerialUntil(reader, /CONFIG_OK|CONFIG_ERROR:/, 3000);
    if (!/CONFIG_OK/.test(output)) {
      const match = output.match(/CONFIG_ERROR:\s*(.*)/);
      throw new Error(match ? `Device rejected configuration: ${match[1].trim()}` : "No response from device — is it running Prismo firmware?");
    }

    onProgress("Configuration saved, rebooting device...");
    // Exit raw REPL and soft-reset so main.py restarts and picks up the
    // config.json we just wrote.
    await writer.write(new Uint8Array([2, 4])); // Ctrl-B, Ctrl-D
  } finally {
    reader.releaseLock();
    writer.releaseLock();
    await transport.disconnect();
  }
}

export function updateWifiCredentials(
  port: SerialPort,
  ssid: string,
  password: string,
  onProgress: (msg: string) => void
): Promise<void> {
  return patchDeviceConfig(port, { wifi_ssid: ssid, wifi_pass: password }, onProgress);
}

async function readSerialUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pattern: RegExp,
  timeoutMs: number
): Promise<string> {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let output = "";
  while (Date.now() < deadline && !pattern.test(output)) {
    const { value } = await Promise.race([
      reader.read(),
      new Promise<{ value?: Uint8Array }>((r) => setTimeout(() => r({ value: undefined }), 100)),
    ]);
    if (value) output += decoder.decode(value);
  }
  return output;
}
