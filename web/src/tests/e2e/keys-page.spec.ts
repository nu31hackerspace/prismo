import { test, expect } from './fixtures';
import {
	loginUser,
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	publishScan,
	navigateToKeys,
	requireMqttUrl
} from './helpers';

test('scanning + naming a key surfaces it on /keys with the device chip', async ({ page }) => {
	await loginUser(page);

	const deviceName = `KeysOne ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	const mqttUrl = requireMqttUrl();
	const uid = `KEYS1-${Date.now()}`;
	await publishScan(mqttUrl, creds, uid);

	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await page.fill('input[name="name"]', 'Alice');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();

	await expect(page.locator('h2:has-text("Allowed Keys")')).toBeVisible();
	await expect(page.locator('text=Alice').first()).toBeVisible({ timeout: 10_000 });

	await navigateToKeys(page);

	const aliceRow = page.locator('div[data-key-id]', { hasText: 'Alice' }).first();
	await expect(aliceRow).toBeVisible();
	await expect(aliceRow.locator(`text="${deviceName}"`)).toBeVisible();
});

test('scanning a known key on a second device does NOT trigger the unauthorized panel', async ({
	page
}) => {
	await loginUser(page);

	const deviceA = `KeysA ${Date.now()}`;
	const deviceB = `KeysB ${Date.now()}`;

	await createDevice(page, deviceA);
	await navigateToDevice(page, deviceA);
	const credsA = await generateMqttCredentials(page);

	const mqttUrl = requireMqttUrl();
	const uid = `KEYS2-${Date.now()}`;
	await publishScan(mqttUrl, credsA, uid);

	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await page.fill('input[name="name"]', 'Bob');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(
		page.locator('[data-section="allowed-keys"]').locator('text=Bob')
	).toBeVisible({ timeout: 10_000 });

	await page.goto('/devices');
	await createDevice(page, deviceB, 'machine');
	await navigateToDevice(page, deviceB);
	const credsB = await generateMqttCredentials(page);

	await publishScan(mqttUrl, credsB, uid);

	// Give the SSE event a moment, then assert the panel does NOT appear —
	// the key is already in the org, so it's not a new unknown.
	await page.waitForTimeout(2_000);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toHaveCount(0);

	await navigateToKeys(page);
	const bobRow = page.locator('div[data-key-id]', { hasText: 'Bob' }).first();
	await expect(bobRow).toBeVisible();
	await bobRow.locator('select[name="deviceSlug"]').selectOption({ label: deviceB });
	await bobRow.locator('button:has-text("Add")').click();
	await expect(bobRow.locator(`text="${deviceB}"`)).toBeVisible({ timeout: 10_000 });

	await page.goto('/devices');
	await navigateToDevice(page, deviceB);
	await expect(
		page.locator('[data-section="allowed-keys"]').locator('text=Bob')
	).toBeVisible({ timeout: 10_000 });
});

test('deleting a key from /keys revokes it from every device', async ({ page }) => {
	await loginUser(page);

	const deviceA = `KeysDelA ${Date.now()}`;
	const deviceB = `KeysDelB ${Date.now()}`;

	await createDevice(page, deviceA);
	await navigateToDevice(page, deviceA);
	const credsA = await generateMqttCredentials(page);

	const mqttUrl = requireMqttUrl();
	const uid = `KEYS4-${Date.now()}`;
	await publishScan(mqttUrl, credsA, uid);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await page.fill('input[name="name"]', 'Dave');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(
		page.locator('[data-section="allowed-keys"]').locator('text=Dave')
	).toBeVisible({ timeout: 10_000 });

	await page.goto('/devices');
	await createDevice(page, deviceB);

	await navigateToKeys(page);
	const daveRow = page.locator('div[data-key-id]', { hasText: 'Dave' }).first();
	await daveRow.locator('select[name="deviceSlug"]').selectOption({ label: deviceB });
	await daveRow.locator('button:has-text("Add")').click();
	await expect(daveRow.locator(`text="${deviceB}"`)).toBeVisible({ timeout: 10_000 });

	page.once('dialog', (dialog) => dialog.accept());
	await daveRow.locator('button:has-text("Delete")').click();

	await expect(page.locator('div[data-key-id]', { hasText: 'Dave' })).toHaveCount(0, { timeout: 10_000 });

	await page.goto('/devices');
	await navigateToDevice(page, deviceA);
	await expect(page.locator('text=No keys allowed yet')).toBeVisible({ timeout: 10_000 });

	await page.goto('/devices');
	await navigateToDevice(page, deviceB);
	await expect(page.locator('text=No keys allowed yet')).toBeVisible({ timeout: 10_000 });
});

test('Last Unauthorized Scan shows the most recent unknown key and stays empty for keys already known by the org', async ({
	page
}) => {
	await loginUser(page);

	const deviceA = `KeysUnauthA ${Date.now()}`;
	const deviceB = `KeysUnauthB ${Date.now()}`;

	await createDevice(page, deviceA);
	await navigateToDevice(page, deviceA);
	const credsA = await generateMqttCredentials(page);

	const mqttUrl = requireMqttUrl();
	const uid1 = `KEYS-UNAUTH1-${Date.now()}`;
	const uid2 = `KEYS-UNAUTH2-${Date.now()}`;

	// First unknown scan — panel should appear and show uid1.
	await publishScan(mqttUrl, credsA, uid1);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await expect(page.locator(`form[action="?/addKey"] input[name="keyId"]`)).toHaveValue(uid1);

	await page.fill('input[name="name"]', 'success_key_1');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(page.locator('text=success_key_1').first()).toBeVisible({ timeout: 10_000 });

	// Second unknown scan with a different uid — panel should refresh to uid2.
	await publishScan(mqttUrl, credsA, uid2);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await expect(page.locator(`form[action="?/addKey"] input[name="keyId"]`)).toHaveValue(uid2, {
		timeout: 10_000
	});

	await page.fill('input[name="name"]', 'key_2');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(page.locator('text=key_2').first()).toBeVisible({ timeout: 10_000 });

	// New device — scanning uid2 (already known by the org) must NOT raise the unauthorized panel.
	await page.goto('/devices');
	await createDevice(page, deviceB);
	await navigateToDevice(page, deviceB);
	const credsB = await generateMqttCredentials(page);

	await publishScan(mqttUrl, credsB, uid2);

	await page.waitForTimeout(2_000);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toHaveCount(0);
});

test('attach a known key to another device from /keys', async ({ page }) => {
	await loginUser(page);

	const deviceA = `KeysAtA ${Date.now()}`;
	const deviceB = `KeysAtB ${Date.now()}`;

	await createDevice(page, deviceA);
	await navigateToDevice(page, deviceA);
	const credsA = await generateMqttCredentials(page);

	const mqttUrl = requireMqttUrl();
	const uid = `KEYS5-${Date.now()}`;
	await publishScan(mqttUrl, credsA, uid);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await page.fill('input[name="name"]', 'Eve');
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(
		page.locator('[data-section="allowed-keys"]').locator('text=Eve')
	).toBeVisible({ timeout: 10_000 });

	await page.goto('/devices');
	await createDevice(page, deviceB);

	await navigateToKeys(page);
	const row = page.locator('div[data-key-id]', { hasText: 'Eve' }).first();
	await row.locator('select[name="deviceSlug"]').selectOption({ label: deviceB });
	await row.locator('button:has-text("Add")').click();

	await expect(row.locator(`text="${deviceB}"`)).toBeVisible({ timeout: 10_000 });

	await page.goto('/devices');
	await navigateToDevice(page, deviceB);
	await expect(
		page.locator('[data-section="allowed-keys"]').locator('text=Eve')
	).toBeVisible({ timeout: 10_000 });
});
