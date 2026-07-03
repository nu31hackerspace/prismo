/**
 * WiFi-outage reconnection e2e test.
 *
 * Kills the Pi-hosted AP while the device is Online, then restores it and
 * asserts the device reconnects WiFi + MQTT on its own — with NO serial
 * interaction and WITHOUT rebooting (heartbeat uptime_s keeps growing across
 * the outage; a watchdog reset would restart it near zero). Ends with a real
 * "Trigger Success" so the physical success pin proves the command topics
 * were re-subscribed on the new connection.
 *
 * Depends on hardware-trigger.spec.ts having flashed this PR's firmware first
 * (alphabetical order guarantees it under workers:1). Provisioning here uses
 * the fast config_dev.py injection path — no firmware rebuild.
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../helpers';
import { waitForSignalActive, waitForSignalInactive } from './lib/gpio';
import { provisionDevice } from './lib/flash';
import { apDown, apUp, ensureApUp } from './lib/wifi';
import { watchDeviceStatus, type StatusWatcher } from './lib/status-watcher';
import { config } from './lib/env';

test('device reconnects WiFi+MQTT after an AP outage without rebooting', async ({ page }) => {
	test.setTimeout(420_000);
	let watcher: StatusWatcher | undefined;
	try {
		// 1. Fresh device + MQTT credentials via the UI, watcher armed before
		//    the device boots so no heartbeat is missed.
		const deviceName = `Reconnect WiFi ${Date.now()}`;
		await createDevice(page, deviceName, 'door');
		await navigateToDevice(page, deviceName);
		const creds = await generateMqttCredentials(page);
		watcher = await watchDeviceStatus(creds);

		// 2. Provision the board over USB serial and wait for Online.
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
			'heartbeat has no uptime_s — is the stand running pre-reconnection firmware? ' +
				'(hardware-trigger.spec.ts must flash this PR build first)'
		).toBeGreaterThan(0);

		// 3. Kill the AP: heartbeats stop, the badge flips Offline (~10-15s).
		await apDown();
		await expect(page.getByText('Offline', { exact: true })).toBeVisible({
			timeout: config.offlineTimeoutMs
		});
		// Let the firmware cycle at least one failed attempt + backoff.
		await page.waitForTimeout(10_000);

		// 4. Restore the AP. From here on the device is NOT touched over serial —
		//    coming back Online is the firmware's own doing.
		await apUp();
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.reconnectTimeoutMs
		});

		// 5. No-reboot proof: uptime tracked wall-clock across the outage.
		const after = await watcher.waitForSample(Date.now(), 20_000);
		const wallDeltaS = (after.receivedAt - before.receivedAt) / 1000;
		expect(
			after.uptimeS,
			'uptime_s reset across the outage — the device rebooted instead of reconnecting'
		).toBeGreaterThan(before.uptimeS! + wallDeltaS - 15);

		// 6. Re-subscription proof: cmd/trigger still reaches the device.
		expect(await waitForSignalInactive(10_000)).toBe(true);
		await page.getByRole('button', { name: 'Trigger Success' }).click();
		expect(
			await waitForSignalActive(),
			'success pin did not fire — command topics were not re-subscribed after reconnect'
		).toBe(true);
		await waitForSignalInactive(10_000); // don't leak a held pin into the next spec
	} finally {
		await ensureApUp(); // never leave the stand without its hotspot
		await watcher?.close();
	}
});
