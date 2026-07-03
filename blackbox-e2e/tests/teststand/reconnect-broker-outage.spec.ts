/**
 * Broker-outage reconnection e2e test.
 *
 * WiFi stays up; only the MQTT broker container is stopped and restarted.
 * This exercises the MQTT-only loss path (ping/heartbeat failures tear the
 * client down) and its backoff reconnect — a code path the AP-outage specs
 * never hit. Cheapest of the reconnection specs; drop this one first if CI
 * minutes ever matter more than the coverage.
 *
 * Depends on hardware-trigger.spec.ts having flashed this PR's firmware first
 * (alphabetical order guarantees it under workers:1).
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../helpers';
import { waitForSignalActive, waitForSignalInactive } from './lib/gpio';
import { provisionDevice } from './lib/flash';
import { watchDeviceStatus, type StatusWatcher } from './lib/status-watcher';
import { config } from './lib/env';
import { run } from './lib/exec';

test('device reconnects MQTT after a broker outage while WiFi stays up', async ({ page }) => {
	test.setTimeout(300_000);
	let watcher: StatusWatcher | undefined;
	try {
		const deviceName = `Reconnect Broker ${Date.now()}`;
		await createDevice(page, deviceName, 'door');
		await navigateToDevice(page, deviceName);
		const creds = await generateMqttCredentials(page);
		watcher = await watchDeviceStatus(creds);

		const tProvision = Date.now();
		await provisionDevice({
			wifiSsid: config.wifiSsid,
			wifiPass: config.wifiPass,
			mqttHost: config.deviceMqttHost,
			mqttPort: config.deviceMqttPort,
			mqttUser: creds.mqttUser,
			mqttPass: creds.mqttPass,
			mode: 'door'
		});
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.onlineTimeoutMs
		});
		const before = await watcher.waitForSample(tProvision, 15_000);
		expect(
			before.uptimeS,
			'heartbeat has no uptime_s — is the stand running pre-reconnection firmware?'
		).toBeGreaterThan(0);

		// 1. Stop the broker: heartbeats fail, the device tears the client down.
		await run('docker', ['stop', config.mqttContainer]);
		await expect(page.getByText('Offline', { exact: true })).toBeVisible({
			timeout: config.offlineTimeoutMs
		});

		// 2. Broker returns: device backoff cap is 30s for MQTT-only loss; the
		//    web app's own MQTT listener also has to reconnect before the badge
		//    can flip, hence the generous window.
		await run('docker', ['start', config.mqttContainer]);
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.reconnectTimeoutMs
		});

		// 3. Same boot throughout (no watchdog reset during the outage)...
		const after = await watcher.waitForSample(Date.now(), 20_000);
		const wallDeltaS = (after.receivedAt - before.receivedAt) / 1000;
		expect(
			after.uptimeS,
			'uptime_s reset across the broker outage — the device rebooted'
		).toBeGreaterThan(before.uptimeS! + wallDeltaS - 15);

		// 4. ...and the command topics were re-subscribed on the new session.
		expect(await waitForSignalInactive(10_000)).toBe(true);
		await page.getByRole('button', { name: 'Trigger Success' }).click();
		expect(
			await waitForSignalActive(),
			'success pin did not fire — command topics were not re-subscribed after broker restart'
		).toBe(true);
		await waitForSignalInactive(10_000);
	} finally {
		// Never leave the stand without its broker.
		await run('docker', ['start', config.mqttContainer], { check: false });
		await watcher?.close();
	}
});
