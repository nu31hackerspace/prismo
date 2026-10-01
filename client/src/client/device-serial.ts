export const SUPPORTED_PROTO = 1;

const PREFIX = "@cfg ";
const MAX_LOG_LINES = 500;

type SettingBase = { key: string; label: string; secret?: boolean; reboot?: boolean };

export type SettingDef =
  | (SettingBase & { type: "string"; max_len: number; default?: string })
  | (SettingBase & { type: "int"; min: number; max: number; default?: number })
  | (SettingBase & { type: "bool"; default?: boolean })
  | (SettingBase & { type: "enum"; options: string[]; default?: string });

export type SecretState = { set: boolean };
export type SettingValue = string | number | boolean;
export type DeviceValues = Record<string, SettingValue | SecretState>;

export type DeviceInfo = { fw: string; model: string; mac: string; proto: number };

export type DeviceStatus = {
  git_commit?: string;
  wifi_connected?: boolean;
  mqtt_connected?: boolean;
  nfc_reader_ok?: boolean | null;
};

type Response = {
  id?: number;
  ok: boolean;
  data?: unknown;
  err?: string;
  fields?: Record<string, string>;
  reboot_required?: boolean;
};

type DeviceEvent = { evt: string; [key: string]: unknown };

type Pending = { resolve: (res: Response) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> };

export class DeviceRequestError extends Error {
  constructor(public code: string, public fields?: Record<string, string>) {
    super(code === "validation" ? "Some values were rejected by the device." : `Device error: ${code}`);
  }
}

export type DeviceSerialHandlers = {
  onLog?: (line: string) => void;
  onEvent?: (event: DeviceEvent) => void;
  onDisconnect?: (serial: DeviceSerial) => void;
};

export class DeviceSerial {
  private readonly encoder = new TextEncoder();
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private closed = false;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly readLoopDone: Promise<void>;
  private readonly onPortDisconnect = (e: Event) => {
    if (e.target === this.port) void this.close();
  };

  private constructor(readonly port: SerialPort, private readonly handlers: DeviceSerialHandlers) {
    this.writer = port.writable!.getWriter();
    this.reader = port.readable!.getReader();
    navigator.serial.addEventListener("disconnect", this.onPortDisconnect);
    this.readLoopDone = this.readLoop();
  }

  static async open(port: SerialPort, handlers: DeviceSerialHandlers = {}): Promise<DeviceSerial> {
    await port.open({ baudRate: 115200 });
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    return new DeviceSerial(port, handlers);
  }

  private async readLoop(): Promise<void> {
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, "");
          buf = buf.slice(i + 1);
          this.onLine(line);
        }
      }
    } catch {
      // The port was unplugged or closed; close() below reports it.
    } finally {
      void this.close();
    }
  }

  private onLine(line: string) {
    if (!line.startsWith(PREFIX)) {
      this.handlers.onLog?.(line);
      return;
    }
    let msg: Response & Partial<DeviceEvent>;
    try {
      msg = JSON.parse(line.slice(PREFIX.length));
    } catch {
      this.handlers.onLog?.(line);
      return;
    }
    if (msg.id != null && this.pending.has(msg.id)) {
      const { resolve, timer } = this.pending.get(msg.id)!;
      clearTimeout(timer);
      this.pending.delete(msg.id);
      resolve(msg);
    } else if (typeof msg.evt === "string") {
      this.handlers.onEvent?.(msg as DeviceEvent);
    }
  }

  private request(cmd: string, extra: Record<string, unknown> = {}, timeoutMs = 2000): Promise<Response> {
    if (this.closed) return Promise.reject(new Error("Device disconnected."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`No response from device (${cmd}).`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.writer.write(this.encoder.encode(PREFIX + JSON.stringify({ id, cmd, ...extra }) + "\n")).catch((e) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
    });
  }

  private async call<T>(cmd: string, extra?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    const res = await this.request(cmd, extra, timeoutMs);
    if (!res.ok) throw new DeviceRequestError(res.err ?? "unknown", res.fields);
    return res.data as T;
  }

  async waitReady(timeoutMs = 10000): Promise<DeviceInfo> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline && !this.closed) {
      try {
        const info = await this.call<DeviceInfo>("info", {}, 1000);
        if (info.proto !== SUPPORTED_PROTO) {
          throw new Error(`Unsupported device protocol v${info.proto}; update the firmware or this page.`);
        }
        return info;
      } catch (e) {
        if (!(e instanceof Error) || !e.message.startsWith("No response")) throw e;
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Device is not responding — is it running Prismo firmware?");
  }

  schema() {
    return this.call<SettingDef[]>("schema");
  }

  get() {
    return this.call<DeviceValues>("get");
  }

  status() {
    return this.call<DeviceStatus>("status");
  }

  async set(values: Record<string, SettingValue | null>): Promise<{ rebootRequired: boolean }> {
    const res = await this.request("set", { values });
    if (!res.ok) throw new DeviceRequestError(res.err ?? "unknown", res.fields);
    return { rebootRequired: !!res.reboot_required };
  }

  async reboot() {
    await this.call("reboot");
  }

  async factoryReset() {
    await this.call("factory_reset");
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    navigator.serial.removeEventListener("disconnect", this.onPortDisconnect);
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Device disconnected."));
    }
    this.pending.clear();
    await this.reader.cancel().catch(() => {});
    await this.readLoopDone;
    this.reader.releaseLock();
    await this.writer.close().catch(() => {});
    this.writer.releaseLock();
    await this.port.close().catch(() => {});
    this.handlers.onDisconnect?.(this);
  }
}

function isSameDevice(a: SerialPort, b: SerialPort) {
  const x = a.getInfo();
  const y = b.getInfo();
  return x.usbVendorId === y.usbVendorId && x.usbProductId === y.usbProductId;
}

export async function connectDevice(
  port: SerialPort,
  handlers: DeviceSerialHandlers,
  timeoutMs = 10000,
): Promise<{ serial: DeviceSerial; info: DeviceInfo }> {
  const serial = await DeviceSerial.open(port, handlers);
  try {
    return { serial, info: await serial.waitReady(timeoutMs) };
  } catch (e) {
    await serial.close();
    throw e;
  }
}

export async function reconnectAfterReset(
  previous: SerialPort,
  handlers: DeviceSerialHandlers,
  timeoutMs = 20000,
): Promise<{ port: SerialPort; serial: DeviceSerial; info: DeviceInfo }> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const candidates = [previous, ...(await navigator.serial.getPorts()).filter((p) => p !== previous && isSameDevice(p, previous))];
    for (const port of candidates) {
      try {
        const { serial, info } = await connectDevice(port, handlers, 4000);
        return { port, serial, info };
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Device did not come back after reboot. Reconnect it manually.");
}

export function appendLogLine(lines: string[], line: string): string[] {
  const next = lines.length >= MAX_LOG_LINES ? lines.slice(lines.length - MAX_LOG_LINES + 1) : lines.slice();
  next.push(line);
  return next;
}
