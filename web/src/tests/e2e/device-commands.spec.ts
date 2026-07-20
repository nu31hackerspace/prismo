import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import {
	SUBTOPICS,
	type CmdRemoveKeyPayload,
	type CmdSyncPayload,
	type CmdTriggerPayload
} from 'mqtt-contract';
import {
	loginUser,
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	publishScan,
	subscribeAsDevice,
	requireMqttUrl,
	type MqttCredentials
} from './helpers';

async function addKeyViaUnauthorizedScan(
	page: Page,
	mqttUrl: string,
	creds: MqttCredentials,
	uid: string,
	name: string
): Promise<void> {
	await publishScan(mqttUrl, creds, uid);
	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
		timeout: 10_000
	});
	await page.fill('input[name="name"]', name);
	await page.locator('form[action="?/addKey"] button:has-text("Add")').click();
	await expect(page.locator('[data-section="allowed-keys"]').locator(`text=${name}`)).toBeVisible({
		timeout: 10_000
	});
}

test('adding a key publishes a retained sync that a reconnecting device receives', async ({
	page
}) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `CmdSync ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	const uid = `SYNCKEY-${Date.now()}`;
	await addKeyViaUnauthorizedScan(page, mqttUrl, creds, uid, 'SyncedUser');

	// Connect only now — like a device that was offline while the key was
	// added. The retained cmd/sync must deliver the allowlist immediately.
	const sync = await subscribeAsDevice(mqttUrl, creds, SUBTOPICS.cmd_sync);
	try {
		const payload = (await sync.next((p) => Array.isArray(p?.keys))) as CmdSyncPayload;
		expect(payload.keys).toEqual([{ uid, username: 'SyncedUser' }]);
	} finally {
		await sync.close();
	}
});

test('removing a key sends cmd/remove_key and clears it from the retained sync', async ({
	page
}) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `CmdRemove ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	const uid = `REMOVEKEY-${Date.now()}`;
	await addKeyViaUnauthorizedScan(page, mqttUrl, creds, uid, 'TempUser');

	const removeFeed = await subscribeAsDevice(mqttUrl, creds, SUBTOPICS.cmd_remove_key);
	const syncFeed = await subscribeAsDevice(mqttUrl, creds, SUBTOPICS.cmd_sync);
	try {
		await page.locator('form[action="?/removeKey"] button:has-text("Remove")').click();

		const removeMsg = (await removeFeed.next((p) => p?.uid === uid)) as CmdRemoveKeyPayload;
		expect(removeMsg.uid).toBe(uid);

		const emptySync = (await syncFeed.next(
			(p) => Array.isArray(p?.keys) && p.keys.length === 0
		)) as CmdSyncPayload;
		expect(emptySync.keys).toEqual([]);
	} finally {
		await removeFeed.close();
		await syncFeed.close();
	}

	await expect(page.locator('text=No keys allowed yet')).toBeVisible({ timeout: 10_000 });
	await expect(page.getByText('Key Removed', { exact: true }).first()).toBeVisible({
		timeout: 10_000
	});
});

test('Trigger Success on a door device delivers cmd/trigger to the device', async ({ page }) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `CmdTrigger ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	const triggerFeed = await subscribeAsDevice(mqttUrl, creds, SUBTOPICS.cmd_trigger);
	try {
		await page.locator('button:has-text("Trigger Success")').click();
		const msg = (await triggerFeed.next((p) => p?.action === 'success')) as CmdTriggerPayload;
		expect(msg).toEqual({ action: 'success' });
	} finally {
		await triggerFeed.close();
	}

	// The trigger is also recorded in the device history.
	await expect(page.getByText('Trigger', { exact: true }).first()).toBeVisible({
		timeout: 10_000
	});
	await expect(page.getByText('success', { exact: true }).first()).toBeVisible();
});

test('Force Sync Keys pushes the retained key list to the device', async ({ page }) => {
	await loginUser(page);
	const mqttUrl = requireMqttUrl();

	const deviceName = `CmdForceSync ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);

	// A fresh device has no retained sync yet — the button must create one.
	const syncFeed = await subscribeAsDevice(mqttUrl, creds, SUBTOPICS.cmd_sync);
	try {
		await page.locator('button:has-text("Force Sync Keys")').click();
		const payload = (await syncFeed.next((p) => Array.isArray(p?.keys))) as CmdSyncPayload;
		expect(payload.keys).toEqual([]);
	} finally {
		await syncFeed.close();
	}

	await expect(page.getByText('Keys Synced', { exact: true }).first()).toBeVisible({
		timeout: 10_000
	});
});
