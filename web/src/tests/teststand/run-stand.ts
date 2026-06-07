/**
 * Test-stand orchestrator (TypeScript, run via tsx).
 *
 * One command to run the full hardware black-box e2e on the Raspberry Pi:
 *   1. bring up the WiFi hotspot the device joins (nmcli),
 *   2. start the production stack (Mongo / MQTT / web) via docker compose,
 *   3. wait for the app to report healthy,
 *   4. run the Playwright hardware suite,
 *   5. tear everything down.
 *
 * Each phase is gated by an env flag so pieces managed externally can be
 * skipped. Networking, USB flashing and GPIO are done by shelling out to the
 * relevant system tools — there is no native TS equivalent.
 *
 *   sudo -E npm run teststand:run        # full run (hotspot needs root)
 *   TESTSTAND_MANAGE_HOTSPOT=false ...   # if the hotspot is already up
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './lib/env';
import { run, spawnStream } from './lib/exec';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');
const webDir = path.join(repoRoot, 'web');
const composeDir = path.join(repoRoot, 'blackbox-e2e');

const flag = (name: string, fallback: string) =>
	(process.env[name] ?? fallback).toLowerCase() === 'true';

const MANAGE_HOTSPOT = flag('TESTSTAND_MANAGE_HOTSPOT', 'true');
const MANAGE_INFRA = flag('TESTSTAND_MANAGE_INFRA', 'true');
const TEARDOWN = flag('TESTSTAND_TEARDOWN', 'true');

const composeArgs = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.teststand.yml'];

// Reuse the proven AP setup the stand already uses (2.4 GHz, wlan0 →
// 192.168.10.1, SSID PrismoTest). env.ts defaults are kept in sync with it.
const apScript = path.join(repoRoot, 'firmware/tests/real_hardware/start-ap.sh');

async function hotspotUp(): Promise<void> {
	console.log(`\n▶ Starting WiFi hotspot "${config.wifiSsid}" on ${config.wifiIface}…`);
	await run('sudo', ['bash', apScript]);
	console.log(`  Device MQTT target: mqtt://${config.deviceMqttHost}:${config.deviceMqttPort}`);
}

async function hotspotDown(): Promise<void> {
	console.log('\n▶ Stopping WiFi hotspot…');
	await run('sudo', ['nmcli', 'connection', 'down', 'prismo-ap'], { check: false });
}

async function infraUp(): Promise<void> {
	console.log('\n▶ Starting production stack (Mongo / MQTT / web)…');
	await run('docker', [...composeArgs, 'up', '--build', '-d'], {
		cwd: composeDir,
		timeoutMs: 600_000
	});

	console.log('  Waiting for the app to become healthy…');
	for (let i = 0; i < 60; i++) {
		const { stdout } = await run(
			'docker',
			[...composeArgs, 'ps', 'app', '--format', '{{.Health}}'],
			{
				cwd: composeDir,
				check: false
			}
		);
		if (stdout.trim() === 'healthy') {
			console.log('  App is healthy.');
			return;
		}
		await new Promise((r) => setTimeout(r, 2_000));
	}
	throw new Error('App did not become healthy in time');
}

async function infraDown(): Promise<void> {
	console.log('\n▶ Stopping production stack…');
	await run('docker', [...composeArgs, 'down', '-v'], { cwd: composeDir, check: false });
}

async function runTests(): Promise<number> {
	console.log('\n▶ Running the hardware Playwright suite…');
	return spawnStream('npx', ['playwright', 'test', '--config', 'playwright.teststand.config.ts'], {
		cwd: webDir,
		env: process.env
	});
}

async function main(): Promise<void> {
	let exitCode = 1;
	try {
		if (MANAGE_HOTSPOT) await hotspotUp();
		if (MANAGE_INFRA) await infraUp();
		exitCode = await runTests();
	} finally {
		if (TEARDOWN) {
			if (MANAGE_INFRA) await infraDown();
			if (MANAGE_HOTSPOT) await hotspotDown();
		}
	}
	console.log(exitCode === 0 ? '\n✅ Test stand run passed.' : '\n❌ Test stand run failed.');
	process.exit(exitCode);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
