/**
 * Hardware-in-the-loop black-box e2e test.
 *
 * Drives the production web app exactly as a user would (create device →
 * build firmware → download), flashes the real ESP32-C3 connected to the Pi
 * with esptool, and asserts on the physical success pin.
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../helpers';
import { isSignalActive, waitForSignalActive } from './lib/gpio';
import { config } from './lib/env';
import { execSync } from 'child_process';

test('device comes Online after firmware download + esptool flash and "Trigger Success" drives the success pin', async ({ page }) => {
	// Firmware build on the Pi worker (up to 10 min, see worker BUILD_TIMEOUT)
	// + esptool flash + boot/online wait.
	test.setTimeout(780_000);

	// 1. Create a door-mode device
	const deviceName = `Stand Device ${Date.now()}`;
	await createDevice(page, deviceName, config.deviceMode as 'door' | 'machine');
	await navigateToDevice(page, deviceName);
	await expect(page.getByText('Offline', { exact: true })).toBeVisible({ timeout: 5_000 });

	// 2. Generate MQTT credentials — the build bakes them into the firmware
	await generateMqttCredentials(page);

	// 3. Enter WiFi credentials and Build Firmware
	await page.getByPlaceholder('WiFi SSID').fill(config.wifiSsid);
	await page.getByPlaceholder('WiFi Password').fill(config.wifiPass);
	await page.getByRole('button', { name: 'Build Firmware' }).click();
	await expect(page.getByText('Building firmware…')).toBeVisible();
	// Matches the worker's BUILD_TIMEOUT (600s) — an arm64 in-container
	// MicroPython build on the Pi regularly exceeds 2 min.
	await expect(page.getByText('Firmware ready!')).toBeVisible({ timeout: 600_000 });

	// 4. Download Firmware
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('link', { name: 'Download Firmware' }).click();
	const download = await downloadPromise;
	const fwPath = await download.path();
	if (!fwPath) throw new Error('Failed to save downloaded firmware');

	// 5. Flash via esptool
	console.log(`Flashing ${fwPath} to ${config.serialPort} via esptool...`);
	execSync(`${config.esptoolBin} --port ${config.serialPort} write-flash 0x0 ${fwPath}`, {
		stdio: 'inherit'
	});

	console.log('Flashed successfully via esptool.');

	// 6. Device boots, joins the AP, connects to MQTT -> badge flips to Online
	await expect(page.getByText('Online', { exact: true })).toBeVisible({
		timeout: config.onlineTimeoutMs
	});

	// 7. Test GPIO Trigger
	expect(await isSignalActive()).toBe(false);
	await page.getByRole('button', { name: 'Trigger Success' }).click();
	const fired = await waitForSignalActive();
	expect(fired, 'success pin should go active within the trigger window').toBe(true);
});
