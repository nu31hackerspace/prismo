import { test, expect } from './fixtures';
import { loginUser } from './helpers';

test('unauthenticated visitors are redirected from protected pages to the landing page', async ({
	page
}) => {
	for (const path of ['/devices', '/keys', '/devices/front-door-abc123']) {
		await page.goto(path);
		await expect(page).toHaveURL('/');
		await expect(page.locator('text="Sign In"').first()).toBeVisible();
	}
});

test('protected API endpoints reject unauthenticated requests with 401', async ({ page }) => {
	const someId = 'aaaaaaaaaaaaaaaaaaaaaaaa';

	const createJob = await page.request.post('/api/jobs', {
		data: { ssid: 'net', password: 'pass', mqttUser: 'user', mqttPass: 'secret', mode: 'door' }
	});
	expect(createJob.status()).toBe(401);

	const jobStatus = await page.request.get(`/api/jobs/${someId}`);
	expect(jobStatus.status()).toBe(401);

	const file = await page.request.get(`/api/files/${someId}`);
	expect(file.status()).toBe(401);

	const events = await page.request.get('/api/devices/front-door-abc123/events');
	expect(events.status()).toBe(401);
});

test('logging out invalidates the session', async ({ page }) => {
	await loginUser(page);

	await page.goto('/auth/logout');
	await expect(page).toHaveURL('/');
	await expect(page.locator('text="Sign In"').first()).toBeVisible();

	await page.goto('/devices');
	await expect(page).toHaveURL('/');
});

test('health endpoint is public and reports database connectivity', async ({ page }) => {
	const res = await page.request.get('/health');
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.status).toBe('ok');
	expect(body.database).toBe('connected');
});
