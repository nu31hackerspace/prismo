import { test, expect } from './fixtures';
import { loginUser, createDevice, navigateToDevice } from './helpers';

test('deleting a device requires the slug and removes it from the list', async ({ page }) => {
	await loginUser(page);

	const deviceName = `Doomed Device ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);

	const deviceSlug = (await page.locator('nav span.font-mono').textContent())?.trim() ?? '';
	expect(deviceSlug).toBeTruthy();

	await page.click('button:has-text("Delete Device")');

	const confirmButton = page.locator('button:has-text("Delete Forever")');
	await expect(confirmButton).toBeDisabled();

	await page.fill('input[name="confirmSlug"]', 'not-the-slug');
	await expect(confirmButton).toBeDisabled();

	await page.fill('input[name="confirmSlug"]', deviceSlug);
	await expect(confirmButton).toBeEnabled();
	await confirmButton.click();

	await expect(page).toHaveURL(/\/devices$/);
	await expect(page.locator(`h3:has-text("${deviceName}")`)).toHaveCount(0);

	await page.goto(`/devices/${deviceSlug}`);
	await expect(page.locator('text="Device not found"').first()).toBeVisible();
});
