import { test, expect } from './fixtures';
import {
	loginUser,
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	regenerateMqttCredentials,
	expectMqttAuthFailure,
	publishDeviceStatus,
	publishScan,
	publishScanTo,
	requireMqttUrl
} from './helpers';

test('broker rejects a device username with a wrong password', async ({ page }) => {
	await loginUser(page);

	const deviceName = `AuthFail ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	const refusal = await expectMqttAuthFailure(
		requireMqttUrl(),
		creds.mqttUser,
		'definitely-not-the-password'
	);
	expect(refusal).toMatch(/connection refused/i);
});

test("device A's credentials cannot publish scans as device B", async ({ page }) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceA = `IsolationA ${Date.now()}`;
	const deviceB = `IsolationB ${Date.now()}`;

	await createDevice(page, deviceA);
	await navigateToDevice(page, deviceA);
	const credsA = await generateMqttCredentials(page);

	await page.goto('/devices');
	await createDevice(page, deviceB);
	await navigateToDevice(page, deviceB);
	const credsB = await generateMqttCredentials(page);

	// Impersonation attempt: device A's credentials, device B's scan topic.
	const uid = `ACL-${Date.now()}`;
	await publishScanTo(mqttUrl, credsA, credsB.mqttUser, uid);

	// The broker ACL must drop the message: nothing shows up on device B's page.
	await page.waitForTimeout(2_000);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toHaveCount(0);
	await expect(page.locator(`text="${uid}"`)).toHaveCount(0);

	// Control: the same scan with device B's own credentials does arrive,
	// proving the earlier silence was the ACL and not a broken pipeline.
	await publishScan(mqttUrl, credsB, uid);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await expect(page.locator(`text="${uid}"`).first()).toBeVisible({ timeout: 10_000 });
});

test('regenerating the MQTT token revokes the previous credentials', async ({ page }) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `TokenRotate ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);

	const oldCreds = await generateMqttCredentials(page);
	await publishDeviceStatus(mqttUrl, oldCreds, true);
	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 10_000 });

	const newCreds = await regenerateMqttCredentials(page, oldCreds);
	expect(newCreds.mqttUser).toBe(oldCreds.mqttUser);

	// The old password must no longer authenticate.
	const refusal = await expectMqttAuthFailure(mqttUrl, oldCreds.mqttUser, oldCreds.mqttPass);
	expect(refusal).toMatch(/connection refused/i);

	// The new credentials keep working end-to-end.
	const uid = `ROTATE-${Date.now()}`;
	await publishScan(mqttUrl, newCreds, uid);
	await expect(page.locator(`text="${uid}"`).first()).toBeVisible({ timeout: 10_000 });
});
