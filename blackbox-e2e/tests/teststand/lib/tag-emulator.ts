/**
 * Drives the PN532 tag emulator — the second ESP32-C3 on the stand — so specs
 * can present a real RF tag to the Prismo reader (see blackbox-e2e/tag-emulator).
 *
 * The emulator firmware is deliberately NOT persisted on the board: main.py
 * spawns a _thread that consumes stdin, which breaks mpremote's raw-REPL
 * handshake once the script is running. So the board carries only stock
 * MicroPython, and every provision() starts from an esptool hard reset (clean
 * REPL), copies the driver, and launches main.py detached (run --no-follow).
 *
 * The serial port is opened once and kept open for the whole spec — reopening
 * risks resetting the (non-persisted) script.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SerialPort, ReadlineParser } from 'serialport';
import { config } from './env';
import { run } from './exec';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emulatorDir = path.resolve(__dirname, '../../../tag-emulator');

type LineWaiter = {
	match: (line: string) => boolean;
	resolve: (line: string) => void;
};

export class TagEmulator {
	private port?: SerialPort;
	private waiters: LineWaiter[] = [];

	async provision(): Promise<void> {
		// Hard-reset out of whatever ran before (chip-id talks to the ROM
		// bootloader and exits with a hard reset; the filesystem is untouched).
		await run(config.esptoolBin, ['--chip', 'esp32c3', '--port', config.emulatorPort, 'chip-id']);
		await run(config.mpremoteBin, [
			'connect',
			config.emulatorPort,
			'cp',
			path.join(emulatorDir, 'PN532.py'),
			':'
		]);
		await run(config.mpremoteBin, [
			'connect',
			config.emulatorPort,
			'run',
			'--no-follow',
			path.join(emulatorDir, 'main.py')
		]);

		this.port = new SerialPort({ path: config.emulatorPort, baudRate: 115200 });
		const parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
		parser.on('data', (raw: string) => this.onLine(raw.trim()));
		await new Promise<void>((resolve, reject) => {
			this.port!.once('open', () => resolve());
			this.port!.once('error', reject);
		});

		// main.py may have printed its banner before the port opened, so sync by
		// probing: "stop" makes the wait loop re-print WAITING_FOR_SERIAL. The
		// PN532 init retries for up to ~30s before the banner can appear.
		const deadline = Date.now() + 45_000;
		for (;;) {
			const banner = this.waitForLine('WAITING_FOR_SERIAL', 5_000).catch(() => null);
			this.port.write('stop\n');
			if (await banner) return;
			if (Date.now() > deadline) {
				throw new Error('tag emulator never reported WAITING_FOR_SERIAL — is the PN532 wired up?');
			}
		}
	}

	/**
	 * Start emulating a 3-byte NFCID1 for `seconds` (the device runs the timer
	 * itself). Resolves once the emulator confirms it is radiating; the reader
	 * sees UID 0x08 + these bytes and may scan it several times in the window.
	 */
	async emulate(key: string, seconds: number = config.emulateSeconds): Promise<void> {
		if (!/^[0-9a-f]{6}$/i.test(key)) {
			throw new Error(`emulated key must be exactly 6 hex chars, got: ${key}`);
		}
		if (!this.port) throw new Error('TagEmulator not provisioned');
		const confirmed = this.waitForLine(`Now emulating NFCID1: ${key.toLowerCase()}`, 10_000);
		this.port.write(`${key.toLowerCase()}:${seconds}\n`);
		await confirmed;
	}

	/** Resolves when the current emulation window ends and the emulator idles. */
	async waitForStop(timeoutMs: number = (config.emulateSeconds + 10) * 1000): Promise<void> {
		await this.waitForLine('WAITING_FOR_SERIAL', timeoutMs);
	}

	async close(): Promise<void> {
		const port = this.port;
		this.port = undefined;
		this.waiters = [];
		if (port?.isOpen) {
			await new Promise<void>((resolve) => port.close(() => resolve()));
		}
	}

	private onLine(line: string): void {
		if (!line) return;
		console.log(`[tag-emulator] ${line}`);
		this.waiters = this.waiters.filter((w) => {
			if (!w.match(line)) return true;
			w.resolve(line);
			return false;
		});
	}

	private waitForLine(substr: string, timeoutMs: number): Promise<string> {
		return new Promise((resolve, reject) => {
			const waiter: LineWaiter = {
				match: (l) => l.includes(substr),
				resolve: (l) => {
					clearTimeout(timer);
					resolve(l);
				}
			};
			const timer = setTimeout(() => {
				this.waiters = this.waiters.filter((w) => w !== waiter);
				reject(new Error(`Timed out waiting for emulator output: ${substr}`));
			}, timeoutMs);
			this.waiters.push(waiter);
		});
	}
}
