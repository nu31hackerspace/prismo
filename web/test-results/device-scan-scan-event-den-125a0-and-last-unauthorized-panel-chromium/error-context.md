# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: device-scan.spec.ts >> scan event: denied NFC scan appears in history and last-unauthorized panel
- Location: src/tests/e2e/device-scan.spec.ts:5:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text="DEADBEEF1777966011638"').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text="DEADBEEF1777966011638"').first()

```

# Test source

```ts
  1  | import mqtt from 'mqtt';
  2  | import { test, expect } from './fixtures';
  3  | import { loginUser, createDevice, navigateToDevice, generateMqttCredentials } from './helpers';
  4  | 
  5  | test('scan event: denied NFC scan appears in history and last-unauthorized panel', async ({
  6  | 	page
  7  | }) => {
  8  | 	await loginUser(page);
  9  | 
  10 | 	const deviceName = `Scan Device ${Date.now()}`;
  11 | 	await createDevice(page, deviceName);
  12 | 	await navigateToDevice(page, deviceName);
  13 | 	const { mqttUser, mqttPass } = await generateMqttCredentials(page);
  14 | 
  15 | 	const mqttUrl = process.env.MQTT_URL;
  16 | 	if (!mqttUrl) throw new Error('MQTT_URL env var is required for E2E testing');
  17 | 
  18 | 	const scannedUid = `DEADBEEF${Date.now()}`;
  19 | 	const deviceClient = mqtt.connect(mqttUrl, {
  20 | 		username: mqttUser.trim(),
  21 | 		password: mqttPass.trim(),
  22 | 		clientId: `ui-test-scan-${Date.now()}`
  23 | 	});
  24 | 
  25 | 	await new Promise<void>((resolve, reject) => {
  26 | 		deviceClient.once('connect', () => {
  27 | 			deviceClient.publish(
  28 | 				`prismo/${mqttUser.trim()}/scan`,
  29 | 				JSON.stringify({ uid: scannedUid, allowed: false }),
  30 | 				{ qos: 1 },
  31 | 				(err: Error | undefined) => {
  32 | 					deviceClient.end();
  33 | 					if (err) reject(err);
  34 | 					else resolve();
  35 | 				}
  36 | 			);
  37 | 		});
  38 | 		deviceClient.once('error', reject);
  39 | 	});
  40 | 
  41 | 	await expect(page.locator('h2:has-text("Last Unauthorized Scan")')).toBeVisible({
  42 | 		timeout: 10_000
  43 | 	});
> 44 | 	await expect(page.locator(`text="${scannedUid}"`).first()).toBeVisible({ timeout: 10_000 });
     |                                                             ^ Error: expect(locator).toBeVisible() failed
  45 | 	await expect(page.locator('text="Denied"').first()).toBeVisible({ timeout: 10_000 });
  46 | });
  47 | 
```