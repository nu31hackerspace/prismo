/**
 * Full device lifecycle + connectivity-recovery e2e test (hardware-in-the-loop).
 *
 * Drives the production web app exactly as a user would — create a device, set
 * its WiFi credentials, build the firmware on the Pi worker, download it and
 * flash the real ESP32-C3 with esptool — then verifies the live device:
 *
 *   1. comes Online and the "Trigger Success" button drives the physical pin;
 *   2. survives a WiFi AP outage: the Pi hotspot is switched off and back on,
 *      and the device reconnects on its own without rebooting;
 *   3. survives a broker outage: the MQTT container is stopped and restarted;
 *   4. connects for the first time after booting with no AP present (the AP is
 *      switched off, the board is reset, then the AP is switched back on).
 *
 * "Without rebooting" is proven by the uptime_s field in the device heartbeat
 * staying monotonic across each outage (a watchdog reset would restart it).
 * The whole run uses one firmware build + flash — the phases share the flashed
 * device, so the ~10 min build is paid once.
 */
import { test, expect } from './fixtures';
import { createDevice, navigateToDevice, generateMqttCredentials } from '../helpers';
import { waitForSignalInactive } from './lib/gpio';
import { apDown, apUp, ensureApUp } from './lib/wifi';
import { watchDeviceStatus, type StatusWatcher } from './lib/status-watcher';
import {
	firstHeartbeat,
	expectTriggerReachesPin,
	expectReconnectCycle
} from './lib/reconnect-helpers';
import { config } from './lib/env';
import { run } from './lib/exec';
import { execSync } from 'child_process';

test('device lifecycle: build, flash, online, trigger, and reconnect after WiFi/broker/boot outages', async ({
	page
}) => {
	// Worker firmware build (up to 10 min) + esptool flash + boot/online waits +
	// three reconnection cycles.
	test.setTimeout(1_500_000);

	let watcher: StatusWatcher | undefined;
	const deviceName = `Stand Device ${Date.now()}`;

	try {
		const creds = await test.step('Create device and generate MQTT credentials', async () => {
			await createDevice(page, deviceName, config.deviceMode as 'door' | 'machine');
			await navigateToDevice(page, deviceName);
			await expect(page.getByText('Offline', { exact: true })).toBeVisible({ timeout: 5_000 });
			return generateMqttCredentials(page);
		});

		// Watch the device's heartbeats from the broker's published port (this
		// path never crosses wlan0, so it survives the AP outages below).
		watcher = await watchDeviceStatus(creds);

		const fwPath = await test.step('Set WiFi credentials and build + download firmware', async () => {
			await page.getByPlaceholder('WiFi SSID').fill(config.wifiSsid);
			await page.getByPlaceholder('WiFi Password').fill(config.wifiPass);
			await page.getByRole('button', { name: 'Build Firmware' }).click();
			await expect(page.getByText('Building firmware…')).toBeVisible();
			// Matches the worker's BUILD_TIMEOUT (600s).
			await expect(page.getByText('Firmware ready!')).toBeVisible({ timeout: 600_000 });

			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('link', { name: 'Download Firmware' }).click();
			const download = await downloadPromise;
			const p = await download.path();
			if (!p) throw new Error('Failed to save downloaded firmware');
			return p;
		});

		await test.step('Flash the device via esptool', async () => {
			console.log(`Flashing ${fwPath} to ${config.serialPort} via esptool…`);
			execSync(`${config.esptoolBin} --chip esp32c3 --port ${config.serialPort} erase_flash`, {
				stdio: 'inherit'
			});
			execSync(
				`${config.esptoolBin} --chip esp32c3 --port ${config.serialPort} --baud 460800 write_flash 0x0 ${fwPath}`,
				{ stdio: 'inherit' }
			);
			console.log('Flashed successfully via esptool.');
		});

		await test.step('Device comes Online and the success button drives the pin', async () => {
			await expect(page.getByText('Online', { exact: true })).toBeVisible({
				timeout: config.onlineTimeoutMs
			});
			await firstHeartbeat(watcher!, Date.now() - config.onlineTimeoutMs);
			await expectTriggerReachesPin(page);
		});

		await test.step('WiFi AP outage → device reconnects without rebooting', async () => {
			await expectReconnectCycle(page, watcher!, apDown, apUp);
		});

		await test.step('Broker outage → device reconnects MQTT without rebooting', async () => {
			await expectReconnectCycle(
				page,
				watcher!,
				() => run('docker', ['stop', config.mqttContainer]).then(() => undefined),
				() => run('docker', ['start', config.mqttContainer]).then(() => undefined)
			);
		});

		await test.step('Boot with no AP → device makes its first connection when the AP appears', async () => {
			await apDown();
			// Reboot the board while its AP is gone: the blocking boot connect
			// fails, the reader loop starts offline, and runtime maintenance owns
			// the (first) connection from then on.
			await run(config.mpremoteBin, ['connect', config.serialPort, 'reset']);
			await page.waitForTimeout(config.bootOfflineGraceMs);
			await expect(page.getByText('Offline', { exact: true })).toBeVisible();

			await apUp();
			await expect(page.getByText('Online', { exact: true })).toBeVisible({
				timeout: config.reconnectTimeoutMs
			});
			await expectTriggerReachesPin(page);
		});
	} finally {
		await ensureApUp(); // never leave the stand without its hotspot
		await run('docker', ['start', config.mqttContainer], { check: false });
		await waitForSignalInactive(10_000).catch(() => undefined);
		await watcher?.close();
	}
});
