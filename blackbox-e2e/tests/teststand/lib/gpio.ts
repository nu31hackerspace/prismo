/**
 * Reads the Pi GPIO line wired (through the isolating relay) to the device's
 * success output. See test-stand/README.md for the wiring.
 *
 * We shell out to `gpioget` (libgpiod). Output format differs between libgpiod
 * v1 (`0` / `1`) and v2 (`"17"=active` / `inactive`), so we parse both. The
 * full command is overridable via TESTSTAND_GPIOGET_BIN for unusual setups.
 */
import { config } from './env';
import { run } from './exec';

/** Returns the raw logical level of the line: 0 (LOW) or 1 (HIGH). */
export async function readLevel(): Promise<number> {
	const { stdout } = await run(config.gpioGetBin, ['-c', config.gpioChip, config.gpioLine], {
		timeoutMs: 5_000
	});
	const s = stdout.trim().toLowerCase();
	// v2 textual form first ("inactive" contains "active", so test it first).
	if (s.includes('inactive')) return 0;
	if (s.includes('active')) return 1;
	const m = s.match(/-?\d+/);
	if (!m) throw new Error(`Could not parse gpioget output: ${JSON.stringify(stdout)}`);
	return Number(m[0]) ? 1 : 0;
}

/** True when the line currently reads the "success signal active" level. */
export async function isSignalActive(): Promise<boolean> {
	return (await readLevel()) === config.gpioActiveLevel;
}

async function waitForSignal(
	active: boolean,
	timeoutMs: number,
	pollMs: number
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	do {
		if ((await isSignalActive()) === active) return true;
		await new Promise((r) => setTimeout(r, pollMs));
	} while (Date.now() < deadline);
	return false;
}

/**
 * Polls the success line until it reads active, or the timeout elapses.
 * Returns true if the signal was observed.
 */
export async function waitForSignalActive(
	timeoutMs: number = config.signalTimeoutMs,
	pollMs = 100
): Promise<boolean> {
	return waitForSignal(true, timeoutMs, pollMs);
}

/**
 * Polls the success line until it reads inactive, or the timeout elapses.
 * The firmware holds the pin for SUCCESS_SIGNAL_DURATION (5s) after a trigger,
 * so specs wait this out before asserting a clean "pin idle" precondition.
 */
export async function waitForSignalInactive(
	timeoutMs: number = config.signalTimeoutMs,
	pollMs = 100
): Promise<boolean> {
	return waitForSignal(false, timeoutMs, pollMs);
}
