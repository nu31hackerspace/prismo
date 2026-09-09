import { test, expect } from './fixtures';
import {
	loginUser,
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	publishDeviceStatus
} from './helpers';

test('device status transitions: offline → online → offline → online', async ({ page }) => {
	const MQTT_URL = process.env.MQTT_URL;
	if (!MQTT_URL) throw new Error('MQTT_URL env var is required for E2E testing');

	await loginUser(page);

	const deviceName = `UI Device ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	await expect(page.locator('text="Offline"').first()).toBeVisible({ timeout: 5_000 });

	const credentials = await generateMqttCredentials(page);

	await publishDeviceStatus(MQTT_URL, credentials, true);
	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 5_000 });

	// Wait for client-side offline timer (ONLINE_THRESHOLD_MS = 10s) to expire
	await expect(page.locator('text="Offline"').first()).toBeVisible({ timeout: 15_000 });

	await publishDeviceStatus(MQTT_URL, credentials, true);
	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 5_000 });
});
