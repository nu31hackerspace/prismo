/**
 * Hardware-in-the-loop black-box e2e test.
 *
 * Drives the production web app exactly as a user would, flashes the real
 * ESP32-C3 connected to the Pi, and asserts on the physical success pin — the
 * only setup shortcut is seeding the session (see fixtures.ts).
 *
 * Flow:
 *   1. Create a device through the UI and generate its MQTT token.
 *   2. Inject that token + the hotspot WiFi into the device and soft-reset it.
 *   3. Assert the web UI shows the device as Online (real MQTT heartbeats).
 *   4. Click "Trigger Success" and assert the Pi reads the success pin active.
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../e2e/helpers';
import { provisionDevice, flashBaseFirmware } from './lib/flash';
import { isSignalActive, waitForSignalActive } from './lib/gpio';
import { config } from './lib/env';

test('device comes Online and "Trigger Success" drives the success pin', async ({ page }) => {
	// Optional one-time base (re)flash — off by default (needs a power-cycle).
	if (config.flashBaseFirmware) {
		await flashBaseFirmware();
	}

	// 1. Create a door-mode device and get its generated MQTT credentials.
	const deviceName = `Stand Device ${Date.now()}`;
	await createDevice(page, deviceName, config.deviceMode as 'door' | 'machine');
	await navigateToDevice(page, deviceName);
	await expect(page.locator('text="Offline"').first()).toBeVisible({ timeout: 5_000 });

	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	// 2. Provision the connected device with this run's WiFi + MQTT config.
	await provisionDevice({
		wifiSsid: config.wifiSsid,
		wifiPass: config.wifiPass,
		mqttHost: config.deviceMqttHost,
		mqttPort: config.deviceMqttPort,
		mqttUser: mqttUser.trim(),
		mqttPass: mqttPass.trim(),
		mode: config.deviceMode
	});

	// 3. The device boots, joins the hotspot, connects to MQTT and starts
	//    publishing real status heartbeats → the badge flips to Online.
	await expect(page.locator('text="Online"').first()).toBeVisible({
		timeout: config.onlineTimeoutMs
	});

	// Sanity: success line should be idle before we trigger.
	expect(await isSignalActive()).toBe(false);

	// 4. Click the real button → MQTT cmd/trigger → device drives GPIO 2 HIGH →
	//    relay closes → Pi line reads the active level.
	await page.click('button:has-text("Trigger Success")');

	const fired = await waitForSignalActive();
	expect(fired, 'success pin should go active within the trigger window').toBe(true);
});
