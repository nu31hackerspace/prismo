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
import { apDown, apUp, ensureApUp } from './lib/wifi';
import {
	createDeviceWithWatcher,
	provisionBoard,
	firstHeartbeat,
	expectNoReboot,
	expectTriggerReachesPin,
	type DeviceUnderTest
} from './lib/reconnect-helpers';
import { config } from './lib/env';

test('device reconnects WiFi+MQTT after an AP outage without rebooting', async ({ page }) => {
	test.setTimeout(420_000);
	let device: DeviceUnderTest | undefined;
	try {
		// 1. Fresh device + creds via the UI (watcher armed before the device
		//    boots), provision over USB serial, wait for Online.
		device = await createDeviceWithWatcher(page, 'Reconnect WiFi');
		const tProvision = await provisionBoard(device.creds);
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.onlineTimeoutMs
		});
		const before = await firstHeartbeat(device.watcher, tProvision);

		// 2. Kill the AP: heartbeats stop, the badge flips Offline (~10-15s).
		await apDown();
		await expect(page.getByText('Offline', { exact: true })).toBeVisible({
			timeout: config.offlineTimeoutMs
		});
		// Let the firmware cycle at least one failed attempt + backoff.
		await page.waitForTimeout(10_000);

		// 3. Restore the AP. From here on the device is NOT touched over serial —
		//    coming back Online is the firmware's own doing.
		await apUp();
		await expect(page.getByText('Online', { exact: true })).toBeVisible({
			timeout: config.reconnectTimeoutMs
		});

		// 4. Same boot across the outage, and cmd/trigger still reaches the pin.
		await expectNoReboot(device.watcher, before);
		await expectTriggerReachesPin(page);
	} finally {
		await ensureApUp(); // never leave the stand without its hotspot
		await device?.watcher.close();
	}
});
