import { test, expect } from './fixtures';
import {
	loginUser,
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	publishScan,
	requireMqttUrl
} from './helpers';

test('device creation requires a name', async ({ page }) => {
	await loginUser(page);

	await page.locator('form[action="?/addDevice"] button:has-text("Add Device")').click();

	// The required name field blocks the submit — no device card is created,
	// so the empty state stays on screen.
	await expect(page.locator('text=No devices found')).toBeVisible();
});

test('multiple devices are listed as independent cards', async ({ page }) => {
	await loginUser(page);

	const stamp = Date.now();
	const doorName = `Door ${stamp}`;
	const machineName = `Machine ${stamp}`;

	await createDevice(page, doorName);
	await createDevice(page, machineName, 'machine');

	await expect(page.locator(`h3:has-text("${doorName}")`)).toBeVisible();
	await expect(page.locator(`h3:has-text("${machineName}")`)).toBeVisible();

	// Each card manages its own device with its own mode.
	await navigateToDevice(page, doorName);
	await expect(page.locator('button:has-text("Trigger Success")')).toBeVisible({ timeout: 5_000 });

	await page.goto('/devices');
	await navigateToDevice(page, machineName);
	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 5_000 });
});

test('allowed and denied scans are recorded in history with the key name', async ({ page }) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `History ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	// Unknown key, denied by the device.
	const uid = `HIST-${Date.now()}`;
	await publishScan(mqttUrl, creds, uid);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await expect(page.getByText('Denied', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

	// Register the key, then the device reports an allowed scan.
	await page.fill('input[name="name"]', 'Grace');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(page.locator('[data-section="allowed-keys"]').locator('text=Grace')).toBeVisible({
		timeout: 10_000
	});

	await publishScan(mqttUrl, creds, uid, { allowed: true });

	await expect(page.getByText('Allowed', { exact: true }).first()).toBeVisible({
		timeout: 10_000
	});
	await expect(page.locator(`text=${uid} · Grace`).first()).toBeVisible({ timeout: 10_000 });
});

test('machine state reported by a device scan is reflected in the UI toggle', async ({ page }) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `MachineState ${Date.now()}`;
	await createDevice(page, deviceName, 'machine');
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 5_000 });

	// The device reports it latched the machine on after a successful local scan.
	const uid = `MACHINE-${Date.now()}`;
	await publishScan(mqttUrl, creds, uid, { allowed: true, machineActive: true });

	// The page picks the new state up live over SSE.
	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });
	await expect(page.locator('button:has-text("Turn On")')).not.toBeVisible();
});
