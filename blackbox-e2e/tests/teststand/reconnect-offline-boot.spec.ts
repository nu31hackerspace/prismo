/**
 * Offline-boot first-connect e2e test.
 *
 * Boots the device with NO AP present: the boot connect fails, the NFC reader
 * loop starts anyway (offline door access), and the runtime maintenance owns
 * connectivity from then on. When the AP appears later the device must make
 * its FIRST WiFi+MQTT connection without any reboot or serial interaction —
 * the path where boot never got far enough to know the broker was reachable.
 *
 * Depends on hardware-trigger.spec.ts having flashed this PR's firmware first
 * (alphabetical order guarantees it under workers:1).
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../helpers';
import { waitForSignalActive, waitForSignalInactive } from './lib/gpio';
import { provisionDevice } from './lib/flash';
import { apDown, apUp, ensureApUp } from './lib/wifi';
import { watchDeviceStatus, type StatusWatcher } from './lib/status-watcher';
import { config } from './lib/env';

test('device that boots with no AP connects when the AP appears later', async ({ page }) => {
	test.setTimeout(420_000);
	let watcher: StatusWatcher | undefined;
	try {
		const deviceName = `Reconnect Boot ${Date.now()}`;
		await createDevice(page, deviceName, 'door');
		await navigateToDevice(page, deviceName);
		const creds = await generateMqttCredentials(page);
		watcher = await watchDeviceStatus(creds);

		// 1. AP goes away BEFORE the device boots (USB serial is unaffected).
		await apDown();
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

		// 2. Boot connect fails (~10s of WiFi attempts, MQTT skipped) and the
		//    reader loop starts. The device must still be Offline — anything
		//    else means it somehow reached the broker without the AP.
		await page.waitForTimeout(config.bootOfflineGraceMs);
		await expect(page.getByText('Offline', { exact: true })).toBeVisible();
		expect(watcher.latest(), 'device heartbeated while its AP was down').toBeUndefined();

		// 3. AP appears: runtime maintenance makes the FIRST connection.
		await apUp();
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.reconnectTimeoutMs
		});

		// 4. No-reboot proof: uptime covers the whole offline period, so this is
		//    the same boot that started with no AP (a reset would restart it).
		const sample = await watcher.waitForSample(Date.now(), 20_000);
		expect(
			sample.uptimeS,
			'heartbeat has no uptime_s — is the stand running pre-reconnection firmware?'
		).toBeGreaterThan((Date.now() - tProvision) / 1000 - 25);

		// 5. Command topics were subscribed on that first runtime connect.
		expect(await waitForSignalInactive(10_000)).toBe(true);
		await page.getByRole('button', { name: 'Trigger Success' }).click();
		expect(
			await waitForSignalActive(),
			'success pin did not fire — command topics were not subscribed on first connect'
		).toBe(true);
		await waitForSignalInactive(10_000);
	} finally {
		await ensureApUp();
		await watcher?.close();
	}
});
