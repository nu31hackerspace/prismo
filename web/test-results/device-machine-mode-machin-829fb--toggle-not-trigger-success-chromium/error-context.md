# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: device-machine-mode.spec.ts >> machine mode page shows turn on/off toggle, not trigger success
- Location: src/tests/e2e/device-machine-mode.spec.ts:6:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/devices$/
Received string:  "http://localhost:4173/auth/google"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    24 × locator resolved to <html>…</html>
       - unexpected value "http://localhost:4173/auth/google"

```

# Test source

```ts
  1   | import mqtt from 'mqtt';
  2   | import { expect, type Page } from '@playwright/test';
  3   | import { deviceTopic, SUBTOPICS, type StatusPayload, type ScanPayload } from 'mqtt-contract';
  4   | 
  5   | export async function loginUser(page: Page): Promise<void> {
  6   | 	await page.goto('/');
  7   | 	await page.click('text="Sign In"');
> 8   | 	await expect(page).toHaveURL(/\/devices$/, { timeout: 10_000 });
      |                     ^ Error: expect(page).toHaveURL(expected) failed
  9   | 	await expect(page.locator('h1', { hasText: 'My Devices' })).toBeVisible({ timeout: 10_000 });
  10  | }
  11  | 
  12  | export type MqttCredentials = {
  13  | 	mqttUser: string;
  14  | 	mqttPass: string;
  15  | };
  16  | 
  17  | export async function createDevice(
  18  | 	page: Page,
  19  | 	deviceName: string,
  20  | 	mode: 'door' | 'machine' = 'door'
  21  | ): Promise<void> {
  22  | 	await expect(page.locator('form[action="?/addDevice"]')).toBeVisible();
  23  | 	await page.fill('input[name="name"]', deviceName);
  24  | 	await page.selectOption('select[name="mode"]', mode);
  25  | 	await page.click('button:has-text("Add Device")');
  26  | 	await expect(page.locator(`h3:has-text("${deviceName}")`)).toBeVisible();
  27  | }
  28  | 
  29  | export async function navigateToDevice(page: Page, deviceName: string): Promise<void> {
  30  | 	const deviceCard = page.locator(`h3:has-text("${deviceName}")`).locator('..');
  31  | 	await deviceCard.locator('a:has-text("Manage")').click();
  32  | 	await expect(page.locator(`nav span:has-text("${deviceName}")`)).toBeVisible();
  33  | }
  34  | 
  35  | export async function generateMqttCredentials(page: Page): Promise<MqttCredentials> {
  36  | 	await page.click('button:has-text("Generate Token")');
  37  | 	const mqttCredsAlert = page.locator('div', { hasText: 'New MQTT Credentials Generated' }).first();
  38  | 	await expect(mqttCredsAlert).toBeVisible();
  39  | 
  40  | 	const rawText = (await mqttCredsAlert.textContent()) ?? '';
  41  | 	const mqttUser = rawText.match(/Username:\s*([^\s]+)/)?.[1] ?? '';
  42  | 	const mqttPass = rawText.match(/Password:\s*([^\s]+)/)?.[1] ?? '';
  43  | 
  44  | 	expect(mqttUser).toBeTruthy();
  45  | 	expect(mqttPass).toBeTruthy();
  46  | 
  47  | 	return { mqttUser, mqttPass };
  48  | }
  49  | 
  50  | export async function publishDeviceStatus(
  51  | 	mqttUrl: string,
  52  | 	credentials: MqttCredentials,
  53  | 	online: boolean
  54  | ): Promise<void> {
  55  | 	const { mqttUser, mqttPass } = credentials;
  56  | 	const client = mqtt.connect(mqttUrl, {
  57  | 		username: mqttUser.trim(),
  58  | 		password: mqttPass.trim(),
  59  | 		clientId: `ui-test-status-${Date.now()}`
  60  | 	});
  61  | 
  62  | 	await new Promise<void>((resolve, reject) => {
  63  | 		client.once('connect', () => {
  64  | 			client.publish(
  65  | 				deviceTopic(mqttUser.trim(), SUBTOPICS.status),
  66  | 				JSON.stringify({ online } satisfies StatusPayload),
  67  | 				{ qos: 1 },
  68  | 				(err: Error | undefined) => {
  69  | 					client.end();
  70  | 					if (err) reject(err);
  71  | 					else resolve();
  72  | 				}
  73  | 			);
  74  | 		});
  75  | 		client.once('error', reject);
  76  | 	});
  77  | }
  78  | 
  79  | export type ScanOptions = { allowed?: boolean; machineActive?: boolean };
  80  | 
  81  | export async function publishScan(
  82  | 	mqttUrl: string,
  83  | 	credentials: MqttCredentials,
  84  | 	uid: string,
  85  | 	opts: ScanOptions = {}
  86  | ): Promise<void> {
  87  | 	const { mqttUser, mqttPass } = credentials;
  88  | 	const payload: ScanPayload = {
  89  | 		uid,
  90  | 		allowed: opts.allowed ?? false
  91  | 	};
  92  | 	if (opts.machineActive !== undefined) payload.machine_active = opts.machineActive;
  93  | 
  94  | 	const client = mqtt.connect(mqttUrl, {
  95  | 		username: mqttUser.trim(),
  96  | 		password: mqttPass.trim(),
  97  | 		clientId: `ui-test-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  98  | 	});
  99  | 
  100 | 	await new Promise<void>((resolve, reject) => {
  101 | 		client.once('connect', () => {
  102 | 			client.publish(
  103 | 				deviceTopic(mqttUser.trim(), SUBTOPICS.scan),
  104 | 				JSON.stringify(payload),
  105 | 				{ qos: 1 },
  106 | 				(err: Error | undefined) => {
  107 | 					client.end();
  108 | 					if (err) reject(err);
```