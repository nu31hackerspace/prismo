// Web Serial API type declarations
// This adds the 'serial' property to the Navigator interface
// for use with esptool-js in browser environments.

interface Serial {
	requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
	getPorts(): Promise<SerialPort[]>;
	addEventListener(type: string, listener: EventListener): void;
	removeEventListener(type: string, listener: EventListener): void;
}

interface SerialPortRequestOptions {
	filters?: SerialPortFilter[];
}

interface SerialPortFilter {
	usbVendorId?: number;
	usbProductId?: number;
}

interface Navigator {
	readonly serial: Serial;
}
