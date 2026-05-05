# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: device-status.spec.ts >> device status transitions: offline → online → offline → online
- Location: src/tests/e2e/device-status.spec.ts:16:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text="Offline"')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text="Offline"')

```

# Test source

```ts
  1  | import { test, expect } from './fixtures';
  2  | import {
  3  | 	loginUser,
  4  | 	createDevice,
  5  | 	navigateToDevice,
  6  | 	generateMqttCredentials,
  7  | 	publishDeviceStatus
  8  | } from './helpers';
  9  | 
  10 | const MQTT_URL =
  11 | 	process.env.MQTT_URL ??
  12 | 	(() => {
  13 | 		throw new Error('MQTT_URL env var is required for E2E testing');
  14 | 	})();
  15 | 
  16 | test('device status transitions: offline → online → offline → online', async ({ page }) => {
  17 | 	await loginUser(page);
  18 | 
  19 | 	const deviceName = `UI Device ${Date.now()}`;
  20 | 	await createDevice(page, deviceName);
  21 | 	await navigateToDevice(page, deviceName);
  22 | 	const credentials = await generateMqttCredentials(page);
  23 | 
> 24 | 	await expect(page.locator('text="Offline"')).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  25 | 
  26 | 	await publishDeviceStatus(MQTT_URL, credentials, true);
  27 | 	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 5_000 });
  28 | 
  29 | 	await page.waitForTimeout(20_000);
  30 | 	await expect(page.locator('text="Offline"').first()).toBeVisible({ timeout: 1_000 });
  31 | 
  32 | 	await publishDeviceStatus(MQTT_URL, credentials, true);
  33 | 
  34 | 	await page.waitForTimeout(2_000);
  35 | 	await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 5_000 });
  36 | });
  37 | 
```