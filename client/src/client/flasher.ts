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
