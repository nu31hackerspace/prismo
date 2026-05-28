import mqtt from 'mqtt';
import { test, expect } from './fixtures';
import { loginUser, createDevice, navigateToDevice, generateMqttCredentials } from './helpers';
import { deviceTopic, SUBTOPICS, type ScanPayload } from '$lib/devices/mqtt-contract.generated';

test('scan event: denied NFC scan appears in history and last-unauthorized panel', async ({
	page
}) => {
	await loginUser(page);

	const deviceName = `Scan Device ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	const mqttUrl = process.env.MQTT_URL;
	if (!mqttUrl) throw new Error('MQTT_URL env var is required for E2E testing');

	const scannedUid = `DEADBEEF${Date.now()}`;
	const deviceClient = mqtt.connect(mqttUrl, {
		username: mqttUser.trim(),
		password: mqttPass.trim(),
		clientId: `ui-test-scan-${Date.now()}`
	});

	await new Promise<void>((resolve, reject) => {
		deviceClient.once('connect', () => {
			deviceClient.publish(
				deviceTopic(mqttUser.trim(), SUBTOPICS.scan),
				JSON.stringify({ uid: scannedUid, allowed: false } satisfies ScanPayload),
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

	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await expect(page.locator(`text="${scannedUid}"`).first()).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('text="Denied"').first()).toBeVisible({ timeout: 10_000 });
});
