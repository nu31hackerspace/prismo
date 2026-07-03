/**
 * Small assertions shared by the reconnection phases of the device-lifecycle
 * spec: the no-reboot proof and the "commands still reach the pin" check.
 */
import { expect, type Page } from '@playwright/test';
import { waitForSignalActive, waitForSignalInactive } from './gpio';
import type { StatusWatcher, StatusSample } from './status-watcher';
import { config } from './env';

/**
 * First heartbeat after the device comes Online. Fails fast with a pointer at
 * stale firmware: pre-reconnection builds send heartbeats without uptime_s.
 */
export async function firstHeartbeat(
	watcher: StatusWatcher,
	afterMs: number
): Promise<StatusSample> {
	const sample = await watcher.waitForSample(afterMs, 15_000);
	expect(
		sample.uptimeS,
		'heartbeat has no uptime_s — the flashed firmware predates the reconnection feature'
	).toBeGreaterThan(0);
	return sample;
}

/**
 * Assert uptime kept growing wall-clock since `before` — i.e. the device
 * reconnected rather than rebooting (a reset would restart uptime near zero).
 */
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
	await waitForSignalInactive(10_000); // don't leave the pin held for the next phase
}

/**
 * Run one outage → recovery cycle while the device stays powered:
 * cut the link, assert the UI flips Offline, restore it, assert the device
 * comes back Online on its own (no reboot), then confirm a command still
 * drives the physical pin. Used for both the WiFi-AP and broker outages.
 */
export async function expectReconnectCycle(
	page: Page,
	watcher: StatusWatcher,
	cut: () => Promise<void>,
	restore: () => Promise<void>
): Promise<void> {
	const before = watcher.latest();
	expect(before, 'no heartbeat captured before the outage').toBeDefined();

	await cut();
	await expect(page.getByText('Offline', { exact: true })).toBeVisible({
		timeout: config.offlineTimeoutMs
	});
	// Let the firmware run through at least one failed attempt + backoff before
	// the link returns, so we exercise the retry loop rather than a lucky race.
	await page.waitForTimeout(10_000);

	await restore();
	await expect(page.getByText('Online', { exact: true })).toBeVisible({
		timeout: config.reconnectTimeoutMs
	});

	await expectNoReboot(watcher, before!);
	await expectTriggerReachesPin(page);
}
