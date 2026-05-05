import { test, expect } from './fixtures';
import {
	loginUser,
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	publishDeviceStatus
} from './helpers';

const MQTT_URL =
	process.env.MQTT_URL ??
	(() => {
		throw new Error('MQTT_URL env var is required for E2E testing');
	})();

test('device status transitions: offline → online → offline → online', async ({ page }) => {
	await loginUser(page);

	const deviceName = `UI Device ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const credentials = await generateMqttCredentials(page);

	await expect(page.locator('text="Offline"')).toBeVisible();

	await publishDeviceStatus(MQTT_URL, credentials, true);
	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 5_000 });

	await page.waitForTimeout(20_000);
	await expect(page.locator('text="Offline"').first()).toBeVisible({ timeout: 1_000 });

	await publishDeviceStatus(MQTT_URL, credentials, true);

	await page.waitForTimeout(2_000);
	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 5_000 });
});
