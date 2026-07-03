/**
 * Shared choreography for the reconnect-*.spec.ts suite: fresh-device setup,
 * serial provisioning, the uptime-based no-reboot proof and the physical
 * trigger check. Keeps the three specs down to their actual outage story.
 */
import { expect, type Page } from '@playwright/test';
import {
	createDevice,
	navigateToDevice,
	generateMqttCredentials,
	type MqttCredentials
} from '../../helpers';
import { provisionDevice } from './flash';
import { waitForSignalActive, waitForSignalInactive } from './gpio';
import { watchDeviceStatus, type StatusWatcher, type StatusSample } from './status-watcher';
import { config } from './env';

export interface DeviceUnderTest {
	deviceName: string;
	creds: MqttCredentials;
	watcher: StatusWatcher;
}

/** Create a fresh device via the UI, generate MQTT creds and arm the status watcher. */
export async function createDeviceWithWatcher(
	page: Page,
	namePrefix: string
): Promise<DeviceUnderTest> {
	const deviceName = `${namePrefix} ${Date.now()}`;
	await createDevice(page, deviceName, 'door');
	await navigateToDevice(page, deviceName);
	const creds = await generateMqttCredentials(page);
	const watcher = await watchDeviceStatus(creds);
	return { deviceName, creds, watcher };
}

/** Inject this run's config over USB serial and soft-reset the board. */
export async function provisionBoard(creds: MqttCredentials): Promise<number> {
	const tProvision = Date.now();
	await provisionDevice({
		wifiSsid: config.wifiSsid,
		wifiPass: config.wifiPass,
		mqttHost: config.deviceMqttHost,
		mqttPort: config.deviceMqttPort,
		mqttUser: creds.mqttUser,
		mqttPass: creds.mqttPass,
		mode: 'door'
	});
	return tProvision;
}

/**
 * First heartbeat after provisioning. Fails fast with a pointer at stale
 * firmware: pre-reconnection builds send heartbeats without uptime_s.
 */
export async function firstHeartbeat(
	watcher: StatusWatcher,
	tProvision: number
): Promise<StatusSample> {
	const sample = await watcher.waitForSample(tProvision, 15_000);
	expect(
		sample.uptimeS,
		'heartbeat has no uptime_s — is the stand running pre-reconnection firmware? ' +
			'(hardware-trigger.spec.ts must flash this PR build first)'
	).toBeGreaterThan(0);
	return sample;
}

/** Assert uptime kept growing wall-clock since `before` — reconnect, not reboot. */
export async function expectNoReboot(watcher: StatusWatcher, before: StatusSample): Promise<void> {
	const after = await watcher.waitForSample(Date.now(), 20_000);
	const wallDeltaS = (after.receivedAt - before.receivedAt) / 1000;
	expect(
		after.uptimeS,
		'uptime_s reset across the outage — the device rebooted instead of reconnecting'
	).toBeGreaterThan(before.uptimeS! + wallDeltaS - 15);
}

/** Click Trigger Success and assert the physical pin fires — proves the command topics are live. */
export async function expectTriggerReachesPin(page: Page): Promise<void> {
	expect(await waitForSignalInactive(10_000)).toBe(true);
	await page.getByRole('button', { name: 'Trigger Success' }).click();
	expect(
		await waitForSignalActive(),
		'success pin did not fire — command topics are not subscribed on the current connection'
	).toBe(true);
	await waitForSignalInactive(10_000); // don't leak a held pin into the next spec
}
