import { test, expect } from '@playwright/test';
import mqtt from 'mqtt';

test.describe('Device Lifecycle UI E2E', () => {
    // Generate a strictly unique name per test run to avoid cross-polluting DB state
    const uniqueDeviceName = `UI Device ${Date.now()}`;

    test('full flow: login, add device, generate credentials, sync status', async ({ page, request }) => {
        await page.goto('/');

        await page.click('text="Sign In"');

        await expect(page.locator('h1', { hasText: 'My Devices' })).toBeVisible({ timeout: 10_000 });
        
        await expect(page.locator('form[action="?/addDevice"]')).toBeVisible();

        await page.fill('input[name="name"]', uniqueDeviceName);
        await page.click('button:has-text("Add Device")');

        const deviceCard = page.locator(`h3:has-text("${uniqueDeviceName}")`).locator('..');
        await expect(deviceCard).toBeVisible();

        await expect(deviceCard.locator('text="Offline"')).toBeVisible();

        await deviceCard.locator('a:has-text("Manage")').click();
        
        await expect(page.locator(`nav span:has-text("${uniqueDeviceName}")`)).toBeVisible();

        await page.click('button:has-text("Generate Token")');
        
        const mqttCredsAlert = page.locator('div', { hasText: 'New MQTT Credentials Generated' }).first();
        await expect(mqttCredsAlert).toBeVisible();

        const rawText = await mqttCredsAlert.textContent() || '';
        const userMatch = rawText.match(/Username:\s*([^\s]+)/);
        const passMatch = rawText.match(/Password:\s*([^\s]+)/);
        
        const mqttUser = userMatch ? userMatch[1] : '';
        const mqttPass = passMatch ? passMatch[1] : '';

        console.log('Extracted credentials from UI ->', { mqttUser, mqttPass });

        expect(mqttUser).toBeTruthy();
        expect(mqttPass).toBeTruthy();

        const mqttUrl = process.env.MQTT_URL;
        if (!mqttUrl) throw new Error('MQTT_URL env var is required for E2E testing');
        
        const deviceClient = mqtt.connect(mqttUrl, {
            username: mqttUser!.trim(),
            password: mqttPass!.trim(),
            clientId: `ui-test-device-${Date.now()}`
        });

        await new Promise<void>((resolve, reject) => {
            deviceClient.once('connect', () => {
                deviceClient.publish(
                    `prismo/${mqttUser!.trim()}/status`,
                    JSON.stringify({ online: true }),
                    { qos: 1 },
                    (err: Error | undefined) => {
                        deviceClient.end();
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            deviceClient.once('error', reject);
        });

        await expect(page.locator('text="Online"').first()).toBeVisible({ timeout: 10_000 });
    });
});
