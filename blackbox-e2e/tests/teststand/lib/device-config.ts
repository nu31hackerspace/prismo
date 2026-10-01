/**
 * Configures the flashed device over its USB serial `@cfg` protocol — the same
 * line protocol the web app's "Setup Device" panel speaks over Web Serial
 * (client/src/client/device-serial.ts, firmware/src/serial_cfg.py). Playwright
 * can't drive the browser's serial port picker, so the stand talks to the
 * port directly.
 */
import { SerialPort, ReadlineParser } from "serialport";
import { config } from "./env";

const PREFIX = "@cfg ";

type Response = {
  id?: number;
  ok: boolean;
  err?: string;
  fields?: Record<string, string>;
};

export async function configureDevice(
  values: Record<string, string>,
): Promise<void> {
  const port = new SerialPort({
    path: config.serialPort,
    baudRate: 115200,
    hupcl: false,
    autoOpen: false,
  });
  await new Promise<void>((resolve, reject) =>
    port.open((err) => (err ? reject(err) : resolve())),
  );
  await new Promise<void>((resolve, reject) =>
    port.set({ dtr: false, rts: false }, (err) =>
      err ? reject(err) : resolve(),
    ),
  );

  const pending = new Map<number, (res: Response) => void>();
  port.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", (raw) => {
    const line = String(raw).replace(/\r$/, "");
    if (!line.startsWith(PREFIX)) return;
    try {
      const msg = JSON.parse(line.slice(PREFIX.length)) as Response;
      if (msg.id != null) pending.get(msg.id)?.(msg);
    } catch {
      // Not a protocol reply.
    }
  });

  let nextId = 1;
  const request = (cmd: string, extra = {}, timeoutMs = 2_000) =>
    new Promise<Response>((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`No response from device (${cmd})`));
      }, timeoutMs);
      pending.set(id, (res) => {
        clearTimeout(timer);
        pending.delete(id);
        resolve(res);
      });
      port.write(PREFIX + JSON.stringify({ id, cmd, ...extra }) + "\n");
    });

  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      const res = await request("info", {}, 1_000).catch(() => null);
      if (res?.ok) break;
      if (Date.now() > deadline) {
        throw new Error("Device never answered @cfg info after flashing");
      }
    }

    const set = await request("set", { values });
    if (!set.ok) {
      throw new Error(
        `Device rejected settings: ${set.err} ${JSON.stringify(set.fields ?? {})}`,
      );
    }
    await request("reboot");
  } finally {
    await new Promise<void>((resolve) => port.close(() => resolve()));
  }
}
