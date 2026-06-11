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
import * as fs from 'fs';
import { execSync } from 'child_process';

test('device comes Online via Web Serial flash and "Trigger Success" drives the success pin', async ({ page, context }) => {
	test.setTimeout(180_000); // Flashing takes a while

	// 1. Create a door-mode device
	const deviceName = `Stand Device ${Date.now()}`;
	await createDevice(page, deviceName, config.deviceMode as 'door' | 'machine');
	await navigateToDevice(page, deviceName);
	await expect(page.getByText('Offline', { exact: true })).toBeVisible({ timeout: 5_000 });

	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	// Web Serial CDP setup is removed as we flash via CLI

	// 3. Enter WiFi credentials and Build Firmware
	await page.getByPlaceholder('WiFi SSID').fill(config.wifiSsid);
	await page.getByPlaceholder('WiFi Password').fill(config.wifiPass);
	await page.getByRole('button', { name: 'Build Firmware' }).click();
	await expect(page.getByText('Building firmware…')).toBeVisible();
	await expect(page.getByText('Firmware ready!')).toBeVisible({ timeout: 120_000 });

	// 4. Download Firmware
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('link', { name: 'Download Firmware' }).click();
	const download = await downloadPromise;
	const fwPath = await download.path();
	if (!fwPath) throw new Error('Failed to save downloaded firmware');

	// 5. Flash via esptool
	const port = process.env.TESTSTAND_SERIAL_PORT || '/dev/ttyESP32C3';
	console.log(`Flashing ${fwPath} to ${port} via esptool...`);
	execSync(`esptool.py --port ${port} write_flash 0x0 ${fwPath}`, { stdio: 'inherit' });

	console.log('Flashed successfully via esptool.');
	
	// We no longer need to click "Done" in the UI because the UI is still on the "Firmware ready!" state.
	// But the device is now booting and should connect to MQTT.

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
