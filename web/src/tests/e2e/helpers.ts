import mqtt from 'mqtt';
import { expect, type Page } from '@playwright/test';
import { deviceTopic, SUBTOPICS, type StatusPayload, type ScanPayload } from 'mqtt-contract';

export async function loginUser(page: Page): Promise<void> {
	await page.goto('/');
	await page.click('text="Sign In"');
	await expect(page).toHaveURL(/\/devices$/, { timeout: 10_000 });
	await expect(page.locator('h1', { hasText: 'My Devices' })).toBeVisible({ timeout: 10_000 });
}

export type MqttCredentials = {
	mqttUser: string;
	mqttPass: string;
};

export async function createDevice(
	page: Page,
	deviceName: string,
	mode: 'door' | 'machine' = 'door'
): Promise<void> {
	await expect(page.locator('form[action="?/addDevice"]')).toBeVisible();
	await page.fill('input[name="name"]', deviceName);
	await page.selectOption('select[name="mode"]', mode);
	await page.click('button:has-text("Add Device")');
	await expect(page.locator(`h3:has-text("${deviceName}")`)).toBeVisible();
}

export async function navigateToDevice(page: Page, deviceName: string): Promise<void> {
	const deviceCard = page.locator(`h3:has-text("${deviceName}")`).locator('..');
	await deviceCard.locator('a:has-text("Manage")').click();
	await expect(page.locator(`nav span:has-text("${deviceName}")`)).toBeVisible();
}

export async function generateMqttCredentials(page: Page): Promise<MqttCredentials> {
	await page.click('button:has-text("Generate Token")');
	const mqttCredsAlert = page.locator('div', { hasText: 'New MQTT Credentials Generated' }).first();
	await expect(mqttCredsAlert).toBeVisible();

	const rawText = (await mqttCredsAlert.textContent()) ?? '';
	const mqttUser = rawText.match(/Username:\s*([^\s]+)/)?.[1] ?? '';
	const mqttPass = rawText.match(/Password:\s*([^\s]+)/)?.[1] ?? '';

	expect(mqttUser).toBeTruthy();
	expect(mqttPass).toBeTruthy();

	return { mqttUser, mqttPass };
}

export async function publishDeviceStatus(
	mqttUrl: string,
	credentials: MqttCredentials,
	online: boolean
): Promise<void> {
	const { mqttUser, mqttPass } = credentials;
	const client = mqtt.connect(mqttUrl, {
		username: mqttUser.trim(),
		password: mqttPass.trim(),
		clientId: `ui-test-status-${Date.now()}`
	});

	await new Promise<void>((resolve, reject) => {
		client.once('connect', () => {
			client.publish(
				deviceTopic(mqttUser.trim(), SUBTOPICS.status),
				JSON.stringify({ online } satisfies StatusPayload),
				{ qos: 1 },
				(err: Error | undefined) => {
					client.end();
					if (err) reject(err);
					else resolve();
				}
			);
		});
		client.once('error', reject);
	});
}

/**
 * Regenerates the device token via the UI and waits until the credentials
 * alert shows a password different from the previous one, so the old alert
 * content is never returned by mistake.
 */
export async function regenerateMqttCredentials(
	page: Page,
	previous: MqttCredentials
): Promise<MqttCredentials> {
	await page.click('button:has-text("Generate Token")');
	const mqttCredsAlert = page.locator('div', { hasText: 'New MQTT Credentials Generated' }).first();
	await expect(mqttCredsAlert).toBeVisible();

	let creds: MqttCredentials = previous;
	await expect(async () => {
		const rawText = (await mqttCredsAlert.textContent()) ?? '';
		const mqttUser = rawText.match(/Username:\s*([^\s]+)/)?.[1] ?? '';
		const mqttPass = rawText.match(/Password:\s*([^\s]+)/)?.[1] ?? '';
		expect(mqttUser).toBeTruthy();
		expect(mqttPass).toBeTruthy();
		expect(mqttPass).not.toBe(previous.mqttPass);
		creds = { mqttUser, mqttPass };
	}).toPass({ timeout: 10_000 });
	return creds;
}

export type ScanOptions = { allowed?: boolean; machineActive?: boolean };

export async function publishScan(
	mqttUrl: string,
	credentials: MqttCredentials,
	uid: string,
	opts: ScanOptions = {}
): Promise<void> {
	return publishScanTo(mqttUrl, credentials, credentials.mqttUser, uid, opts);
}

/**
 * Publishes a scan to an arbitrary device's topic. The target may differ from
 * the credential owner — the broker ACL is expected to drop such messages.
 */
export async function publishScanTo(
	mqttUrl: string,
	credentials: MqttCredentials,
	targetDeviceUser: string,
	uid: string,
	opts: ScanOptions = {}
): Promise<void> {
	const { mqttUser, mqttPass } = credentials;
	const payload: ScanPayload = {
		uid,
		allowed: opts.allowed ?? false
	};
	if (opts.machineActive !== undefined) payload.machine_active = opts.machineActive;

	const client = mqtt.connect(mqttUrl, {
		username: mqttUser.trim(),
		password: mqttPass.trim(),
		clientId: `ui-test-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	});

	await new Promise<void>((resolve, reject) => {
		client.once('connect', () => {
			client.publish(
				deviceTopic(targetDeviceUser.trim(), SUBTOPICS.scan),
				JSON.stringify(payload),
				{ qos: 1 },
				(err: Error | undefined) => {
					client.end();
					if (err) reject(err);
					else resolve();
				}
			);
		});
		client.once('error', reject);
	});
}

/**
 * Attempts an MQTT connection and resolves with the broker's refusal message.
 * Rejects if the broker accepts the credentials.
 */
export function expectMqttAuthFailure(
	mqttUrl: string,
	username: string,
	password: string
): Promise<string> {
	return new Promise((resolve, reject) => {
		const client = mqtt.connect(mqttUrl, {
			username: username.trim(),
			password: password.trim(),
			reconnectPeriod: 0,
			connectTimeout: 5_000,
			clientId: `ui-test-authfail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		});
		const timer = setTimeout(() => {
			client.end(true);
			reject(new Error('Broker did not answer the connection attempt in time'));
		}, 10_000);
		client.once('connect', () => {
			clearTimeout(timer);
			client.end(true);
			reject(new Error('Broker accepted credentials that should have been rejected'));
		});
		client.once('error', (err) => {
			clearTimeout(timer);
			client.end(true);
			resolve(err.message);
		});
	});
}

export type DeviceSubscription = {
	/** Returns the first (queued or future) message matching the predicate. */
	next: (match?: (payload: any) => boolean, timeoutMs?: number) => Promise<unknown>;
	close: () => Promise<void>;
};

/**
 * Connects with the device's own credentials and subscribes to one of its
 * subtopics — the device's point of view on server→device commands.
 * Retained messages (e.g. cmd/sync) arrive immediately after subscribing.
 */
export async function subscribeAsDevice(
	mqttUrl: string,
	credentials: MqttCredentials,
	subtopic: string
): Promise<DeviceSubscription> {
	const { mqttUser, mqttPass } = credentials;
	const topic = deviceTopic(mqttUser.trim(), subtopic);
	const client = mqtt.connect(mqttUrl, {
		username: mqttUser.trim(),
		password: mqttPass.trim(),
		clientId: `ui-test-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	});

	const messages: unknown[] = [];
	client.on('message', (_topic, raw) => {
		try {
			messages.push(JSON.parse(raw.toString()));
		} catch {
			// Non-JSON payloads are not part of the contract; ignore them.
		}
	});

	await new Promise<void>((resolve, reject) => {
		client.once('connect', () => {
			client.subscribe(topic, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
		});
		client.once('error', reject);
	});

	return {
		async next(match = () => true, timeoutMs = 10_000) {
			const deadline = Date.now() + timeoutMs;
			let cursor = 0;
			while (Date.now() < deadline) {
				while (cursor < messages.length) {
					const candidate = messages[cursor++];
					if (match(candidate)) return candidate;
				}
				await new Promise((r) => setTimeout(r, 200));
			}
			throw new Error(`No matching message arrived on ${topic} within ${timeoutMs}ms`);
		},
		async close() {
			await client.endAsync();
		}
	};
}

export async function navigateToKeys(page: Page): Promise<void> {
	await page.goto('/keys');
	await expect(page.locator('h1', { hasText: 'Keys' })).toBeVisible();
}

export function requireMqttUrl(): string {
	const url = process.env.MQTT_URL;
	if (!url) throw new Error('MQTT_URL env var is required for E2E testing');
	return url;
}
