/**
 * WiFi hotspot control for the reconnection specs.
 *
 * The Pi serves the AP the device joins (NetworkManager profile `prismo-ap`,
 * created by firmware/tests/real_hardware/start-ap.sh). Taking the connection
 * down kills the device's WiFi link while the Pi keeps its Ethernet uplink,
 * the docker stack and the USB serial port — exactly the "AP power loss" case.
 *
 * Requires passwordless sudo for nmcli (the CI runner has it; locally run the
 * suite via `sudo -E npm run teststand:run` or add an NOPASSWD rule).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './env';
import { run } from './exec';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

/** Take the AP down: the device loses WiFi within seconds. */
export async function apDown(): Promise<void> {
	await run('sudo', ['nmcli', 'connection', 'down', config.apProfileName]);
}

/**
 * Bring the AP back. `connection down` keeps the profile, so `connection up`
 * is the fast path; fall back to the full start-ap.sh (idempotent — it
 * recreates the profile) if the profile has gone missing.
 */
export async function apUp(): Promise<void> {
	const res = await run(
		'sudo',
		['nmcli', 'connection', 'up', config.apProfileName, 'ifname', config.wifiIface],
		{ check: false }
	);
	if (/error|unknown connection/i.test(res.stderr)) {
		await run('bash', [path.resolve(repoRoot, config.startApScript)]);
	}
}

/**
 * Best-effort AP restore for finally blocks: never throws, so a failing spec
 * can't leave the stand without its hotspot (which would cascade into every
 * later spec).
 */
export async function ensureApUp(): Promise<void> {
	try {
		await apUp();
	} catch (err) {
		console.error('ensureApUp failed (stand may need manual AP restore):', err);
	}
}
