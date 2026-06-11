/**
 * Hardware-in-the-loop black-box e2e test.
 *
 * Drives the production web app exactly as a user would, flashes the real
 * ESP32-C3 connected to the Pi using the Web Serial API, and asserts on the
 * physical success pin.
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../helpers';
import { isSignalActive, waitForSignalActive } from './lib/gpio';
import { config } from './lib/env';
import type { CDPSession } from '@playwright/test';
import * as fs from 'fs';

test('device comes Online via Web Serial flash and "Trigger Success" drives the success pin', async ({ page, context }) => {
	test.setTimeout(180_000); // Flashing takes a while

	// 1. Create a door-mode device
	const deviceName = `Stand Device ${Date.now()}`;
	await createDevice(page, deviceName, config.deviceMode as 'door' | 'machine');
	await navigateToDevice(page, deviceName);
	await expect(page.getByText('Offline', { exact: true })).toBeVisible({ timeout: 5_000 });

	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	// 2. Setup Web Serial CDP
	const cdp: CDPSession = await context.newCDPSession(page);
	await cdp.send('DeviceAccess.enable');
	cdp.on('DeviceAccess.deviceRequestPrompted', async (params) => {
		console.log('Device request prompted:', params);
		fs.writeFileSync('params.json', JSON.stringify(params, null, 2));
		if (params.devices && params.devices.length > 0) {
			await cdp.send('DeviceAccess.selectPrompt', { id: params.id, deviceId: params.devices[0].id });
		} else {
			await cdp.send('DeviceAccess.cancelPrompt', { id: params.id });
		}
	});

	// 3. Enter WiFi credentials and Build Firmware
	await page.getByPlaceholder('WiFi SSID').fill(config.wifiSsid);
	await page.getByPlaceholder('WiFi Password').fill(config.wifiPass);
	await page.getByRole('button', { name: 'Build Firmware' }).click();
	await expect(page.getByText('Building firmware…')).toBeVisible();
	await expect(page.getByText('Firmware ready!')).toBeVisible({ timeout: 120_000 });

	// 4. Connect Device and Flash
	const connectButton = page.getByRole('button', { name: 'Connect Device' });
	await expect(connectButton).toBeVisible();
	await connectButton.click(); // Triggers Web Serial

	const flashButton = page.getByRole('button', { name: 'Flash Firmware' });
	await expect(flashButton).toBeVisible({ timeout: 10000 });
	await flashButton.click();

	// 5. Wait for flash to complete
	await expect(page.getByText('Writing firmware')).toBeVisible({ timeout: 10000 });
	await expect(page.getByText('Firmware flashed successfully')).toBeVisible({ timeout: 120_000 });
	await expect(page.getByText('Device is ready')).toBeVisible({ timeout: 60_000 });

	const doneButton = page.getByRole('button', { name: 'Done' });
	if (await doneButton.isVisible()) await doneButton.click();

	// 6. Device boots and connects to MQTT -> flips to Online
	await expect(page.getByText('online', { exact: true })).toBeVisible({
		timeout: config.onlineTimeoutMs
	});

	// 7. Test GPIO Trigger
	expect(await isSignalActive()).toBe(false);
	await page.getByRole('button', { name: 'Trigger Success' }).click();
	const fired = await waitForSignalActive();
	expect(fired, 'success pin should go active within the trigger window').toBe(true);
});
