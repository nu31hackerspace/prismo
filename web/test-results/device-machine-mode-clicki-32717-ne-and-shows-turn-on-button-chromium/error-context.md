# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: device-machine-mode.spec.ts >> clicking turn off deactivates machine and shows turn on button
- Location: src/tests/e2e/device-machine-mode.spec.ts:52:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Turn On")')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button:has-text("Turn On")')

```

# Test source

```ts
  1   | import mqtt from 'mqtt';
  2   | import { test, expect } from './fixtures';
  3   | import {
  4   | 	loginUser,
  5   | 	createDevice,
  6   | 	navigateToDevice,
  7   | 	generateMqttCredentials,
  8   | 	setDeviceModeInDb
  9   | } from './helpers';
  10  | 
  11  | test('machine mode page shows turn on/off toggle, not trigger success', async ({ page }) => {
  12  | 	await loginUser(page);
  13  | 
  14  | 	const deviceName = `Machine Device ${Date.now()}`;
  15  | 	await createDevice(page, deviceName);
  16  | 	await navigateToDevice(page, deviceName);
  17  | 	await setDeviceModeInDb(deviceName, 'machine', { isOn: false });
  18  | 	await page.reload();
  19  | 
  20  | 	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 5_000 });
  21  | 	await expect(page.locator('button:has-text("Trigger Success")')).not.toBeVisible();
  22  | });
  23  | 
  24  | test('clicking turn on activates machine and shows turn off button', async ({ page }) => {
  25  | 	await loginUser(page);
  26  | 
  27  | 	const deviceName = `Machine Device ${Date.now()}`;
  28  | 	await createDevice(page, deviceName);
  29  | 	await navigateToDevice(page, deviceName);
  30  | 	await setDeviceModeInDb(deviceName, 'machine', { isOn: false });
  31  | 	await page.reload();
  32  | 
  33  | 	await page.locator('button:has-text("Turn On")').click();
  34  | 
  35  | 	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });
  36  | 	await expect(page.locator('button:has-text("Turn On")')).not.toBeVisible();
  37  | });
  38  | 
  39  | test('page with machine already on shows turn off button', async ({ page }) => {
  40  | 	await loginUser(page);
  41  | 
  42  | 	const deviceName = `Machine Device ${Date.now()}`;
  43  | 	await createDevice(page, deviceName);
  44  | 	await navigateToDevice(page, deviceName);
  45  | 	await setDeviceModeInDb(deviceName, 'machine', { isOn: true });
  46  | 	await page.reload();
  47  | 
  48  | 	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 5_000 });
  49  | 	await expect(page.locator('button:has-text("Turn On")')).not.toBeVisible();
  50  | });
  51  | 
  52  | test('clicking turn off deactivates machine and shows turn on button', async ({ page }) => {
  53  | 	await loginUser(page);
  54  | 
  55  | 	const deviceName = `Machine Device ${Date.now()}`;
  56  | 	await createDevice(page, deviceName);
  57  | 	await navigateToDevice(page, deviceName);
  58  | 	await setDeviceModeInDb(deviceName, 'machine', { isOn: true });
  59  | 	await page.reload();
  60  | 
  61  | 	await page.locator('button:has-text("Turn Off")').click();
  62  | 
> 63  | 	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 10_000 });
      |                                                           ^ Error: expect(locator).toBeVisible() failed
  64  | 	await expect(page.locator('button:has-text("Turn Off")')).not.toBeVisible();
  65  | });
  66  | 
  67  | test('mqtt scan with machine_active updates toggle button via sse', async ({ page }) => {
  68  | 	await loginUser(page);
  69  | 
  70  | 	const deviceName = `Machine Device ${Date.now()}`;
  71  | 	await createDevice(page, deviceName);
  72  | 	await navigateToDevice(page, deviceName);
  73  | 	const { mqttUser, mqttPass } = await generateMqttCredentials(page);
  74  | 	await setDeviceModeInDb(deviceName, 'machine', { isOn: false });
  75  | 	await page.reload();
  76  | 
  77  | 	await expect(page.locator('button:has-text("Turn On")')).toBeVisible({ timeout: 5_000 });
  78  | 
  79  | 	const mqttUrl = process.env.MQTT_URL;
  80  | 	if (!mqttUrl) throw new Error('MQTT_URL env var is required for E2E testing');
  81  | 
  82  | 	const scannedUid = `DEADBEEF${Date.now()}`;
  83  | 	const deviceClient = mqtt.connect(mqttUrl, {
  84  | 		username: mqttUser.trim(),
  85  | 		password: mqttPass.trim(),
  86  | 		clientId: `ui-test-machine-${Date.now()}`
  87  | 	});
  88  | 
  89  | 	await new Promise<void>((resolve, reject) => {
  90  | 		deviceClient.once('connect', () => {
  91  | 			deviceClient.publish(
  92  | 				`prismo/${mqttUser.trim()}/scan`,
  93  | 				JSON.stringify({ uid: scannedUid, allowed: true, machine_active: true }),
  94  | 				{ qos: 1 },
  95  | 				(err: Error | undefined) => {
  96  | 					deviceClient.end();
  97  | 					if (err) reject(err);
  98  | 					else resolve();
  99  | 				}
  100 | 			);
  101 | 		});
  102 | 		deviceClient.once('error', reject);
  103 | 	});
  104 | 
  105 | 	await expect(page.locator('button:has-text("Turn Off")')).toBeVisible({ timeout: 10_000 });
  106 | });
  107 | 
```