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
import {
	createDeviceWithWatcher,
	provisionBoard,
	firstHeartbeat,
	expectNoReboot,
	expectTriggerReachesPin,
	type DeviceUnderTest
} from './lib/reconnect-helpers';
import { config } from './lib/env';
import { run } from './lib/exec';

test('device reconnects MQTT after a broker outage while WiFi stays up', async ({ page }) => {
	test.setTimeout(300_000);
	let device: DeviceUnderTest | undefined;
	try {
		device = await createDeviceWithWatcher(page, 'Reconnect Broker');
		const tProvision = await provisionBoard(device.creds);
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.onlineTimeoutMs
		});
		const before = await firstHeartbeat(device.watcher, tProvision);

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

		// 3. Same boot across the outage, and the command topics were
		//    re-subscribed on the new session.
		await expectNoReboot(device.watcher, before);
		await expectTriggerReachesPin(page);
	} finally {
		// Never leave the stand without its broker.
		await run('docker', ['start', config.mqttContainer], { check: false });
		await device?.watcher.close();
	}
});
