import { ESPLoader, Transport } from 'esptool-js';
import type { IEspLoaderTerminal } from 'esptool-js';

const FIRMWARE_URL = '/firmware/firmware.bin';
const BAUD_RATE = 115200;
const ROM_BAUD_RATE = 115200;

export type FlasherState = 'idle' | 'connecting' | 'connected' | 'flashing' | 'done' | 'error';

export interface FlasherLog {
	type: 'info' | 'error' | 'debug';
	message: string;
	timestamp: Date;
}

export interface FlasherInfo {
	chipName: string;
	chipId: string;
}

export interface FlasherCallbacks {
	onStateChange: (state: FlasherState) => void;
	onLog: (log: FlasherLog) => void;
	onProgress: (percent: number) => void;
	onChipInfo: (info: FlasherInfo) => void;
	onError: (message: string) => void;
}

function createLog(type: FlasherLog['type'], message: string): FlasherLog {
	return { type, message, timestamp: new Date() };
}

export function isWebSerialSupported(): boolean {
	return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function connectToDevice(callbacks: FlasherCallbacks): Promise<{
	esploader: ESPLoader;
	transport: Transport;
}> {
	callbacks.onStateChange('connecting');
	callbacks.onLog(createLog('info', 'Requesting serial port...'));

	const port = await navigator.serial.requestPort();
	callbacks.onLog(createLog('info', 'Serial port selected'));

	const transport = new Transport(port);

	const terminal: IEspLoaderTerminal = {
		clean() {
			// no-op
		},
		writeLine(data: string) {
			callbacks.onLog(createLog('debug', data));
		},
		write(data: string) {
			callbacks.onLog(createLog('debug', data));
		}
	};

	const esploader = new ESPLoader({
		transport,
		baudrate: BAUD_RATE,
		romBaudrate: ROM_BAUD_RATE,
		terminal
	});

	callbacks.onLog(createLog('info', 'Connecting to device...'));

	const chipName = await esploader.main();
	callbacks.onLog(createLog('info', `Connected! Chip: ${chipName}`));

	const chipId = await esploader.chip.getChipDescription(esploader);
	callbacks.onLog(createLog('info', `Chip ID: ${chipId}`));

	callbacks.onChipInfo({ chipName, chipId });
	callbacks.onStateChange('connected');

	return { esploader, transport };
}

export async function flashFirmware(
	esploader: ESPLoader,
	callbacks: FlasherCallbacks
): Promise<void> {
	callbacks.onStateChange('flashing');
	callbacks.onLog(createLog('info', 'Fetching firmware binary...'));

	const response = await fetch(FIRMWARE_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch firmware: ${response.status} ${response.statusText}`);
	}

	const firmwareBuffer = await response.arrayBuffer();
	const firmwareData = Array.from(new Uint8Array(firmwareBuffer))
		.map((b) => String.fromCharCode(b))
		.join('');

	const sizeKB = (firmwareBuffer.byteLength / 1024).toFixed(1);
	callbacks.onLog(createLog('info', `Firmware loaded: ${sizeKB} KB`));
	callbacks.onLog(createLog('info', 'Erasing flash and writing firmware...'));

	await esploader.writeFlash({
		fileArray: [{ data: firmwareData, address: 0x0 }],
		flashSize: 'keep',
		flashMode: 'keep',
		flashFreq: 'keep',
		eraseAll: true,
		compress: true,
		reportProgress: (_fileIndex: number, written: number, total: number) => {
			const percent = Math.round((written / total) * 100);
			callbacks.onProgress(percent);
		}
	});

	callbacks.onLog(createLog('info', 'Firmware flashed successfully!'));
	callbacks.onProgress(100);
	callbacks.onStateChange('done');
}

export async function disconnectDevice(transport: Transport): Promise<void> {
	await transport.disconnect();
}
