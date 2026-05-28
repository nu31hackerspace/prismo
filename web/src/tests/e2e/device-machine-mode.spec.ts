import mqtt from 'mqtt';
import { test, expect } from './fixtures';
import { loginUser, createDevice, navigateToDevice, generateMqttCredentials } from './helpers';
import { deviceTopic, SUBTOPICS, type ScanPayload } from '$lib/devices/mqtt-contract.generated';

test('machine mode page shows turn on/off toggle, not trigger success', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Machine Device ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);

	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 5_000 });
	await expect(page.locator('button:has-text("Trigger Success")')).not.toBeVisible();
});

test('clicking turn on activates machine and shows turn off button', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Machine Device ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);

	await page.locator('button:has-text("Turn On")').click();

	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('button:has-text("Turn On")')).not.toBeVisible();
});

test('page with machine already on shows turn off button', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Machine Device ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);

	// Turn the machine on via UI first
	await page.locator('button:has-text("Turn On")').click();
	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });

	// Reload to confirm state is persisted
	await page.reload();

	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 5_000 });
	await expect(page.locator('button:has-text("Turn On")')).not.toBeVisible();
});

test('clicking turn off deactivates machine and shows turn on button', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Machine Device ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);

	// Turn on first
	await page.locator('button:has-text("Turn On")').click();
	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });

	// Now turn off
	await page.locator('button:has-text("Turn Off")').click();

	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('button:has-text("Turn Off")')).not.toBeVisible();
});

test('mqtt scan with machine_active false turns machine off via sse', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Machine Device ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);
	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	// Turn machine on via UI so we can test turning it off via MQTT
	await page.locator('button:has-text("Turn On")').click();
	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });

	const mqttUrl = process.env.MQTT_URL;
	if (!mqttUrl) throw new Error('MQTT_URL env var is required for E2E testing');

	const scannedUid = `DEADBEEF${Date.now()}`;
	const deviceClient = mqtt.connect(mqttUrl, {
		username: mqttUser.trim(),
		password: mqttPass.trim(),
		clientId: `ui-test-machine-off-${Date.now()}`
	});

	await new Promise<void>((resolve, reject) => {
		deviceClient.once('connect', () => {
			deviceClient.publish(
				deviceTopic(mqttUser.trim(), SUBTOPICS.scan),
				JSON.stringify({
					uid: scannedUid,
					allowed: true,
					machine_active: false
				} satisfies ScanPayload),
				{ qos: 1 },
				(err: Error | undefined) => {
					deviceClient.end();
					if (err) reject(err);
					else resolve();
				}
			);
		});
		deviceClient.once('error', reject);
	});

	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('button:has-text("Turn Off")')).not.toBeVisible();
});

test('mqtt scan with machine_active updates toggle button via sse', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Machine Device ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);
	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 5_000 });

	const mqttUrl = process.env.MQTT_URL;
	if (!mqttUrl) throw new Error('MQTT_URL env var is required for E2E testing');

	const scannedUid = `DEADBEEF${Date.now()}`;
	const deviceClient = mqtt.connect(mqttUrl, {
		username: mqttUser.trim(),
		password: mqttPass.trim(),
		clientId: `ui-test-machine-${Date.now()}`
	});

	await new Promise<void>((resolve, reject) => {
		deviceClient.once('connect', () => {
			deviceClient.publish(
				deviceTopic(mqttUser.trim(), SUBTOPICS.scan),
				JSON.stringify({
					uid: scannedUid,
					allowed: true,
					machine_active: true
				} satisfies ScanPayload),
				{ qos: 1 },
				(err: Error | undefined) => {
					deviceClient.end();
					if (err) reject(err);
					else resolve();
				}
			);
		});
		deviceClient.once('error', reject);
	});

	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });
});
