import { test, expect } from './fixtures';
import { loginUser, createDevice, navigateToDevice, generateMqttCredentials } from './helpers';

const POLL_INTERVAL_MS = 2_000;
const BUILD_TIMEOUT_MS = 300_000;

test('firmware build and download: build job completes and file is downloadable', async ({
	page
}) => {
	test.setTimeout(360_000);
	await loginUser(page);

	const deviceName = `Flash Device ${Date.now()}`;
	await createDevice(page, deviceName);
	await navigateToDevice(page, deviceName);
	const { mqttUser, mqttPass } = await generateMqttCredentials(page);

	const jobRes = await page.request.post('/api/jobs', {
		data: {
			ssid: 'TestNetwork',
			password: 'TestPassword123',
			mqttUser,
			mqttPass,
			mode: 'door'
		}
	});
	expect(jobRes.ok()).toBeTruthy();
	const { jobId } = await jobRes.json();
	expect(jobId).toBeTruthy();

	let fileId: string | undefined;
	const deadline = Date.now() + BUILD_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const statusRes = await page.request.get(`/api/jobs/${jobId}`);
		expect(statusRes.ok()).toBeTruthy();
		const job = await statusRes.json();

		if (job.status === 'completed') {
			fileId = job.outputPayload?.fileId;
			break;
		}
		if (job.status === 'failed') {
			throw new Error(`Build job failed: ${job.outputPayload?.error ?? 'unknown error'}`);
		}

		await page.waitForTimeout(POLL_INTERVAL_MS);
	}

	expect(fileId).toBeTruthy();

	const fileRes = await page.request.get(`/api/files/${fileId}`);
	expect(fileRes.ok()).toBeTruthy();
	expect(fileRes.headers()['content-type']).toBe('application/octet-stream');
	expect(fileRes.headers()['content-disposition']).toContain('prismo-firmware.bin');

	const body = await fileRes.body();
	expect(body.length).toBeGreaterThan(0);
});
