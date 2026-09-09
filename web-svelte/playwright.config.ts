import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const EXTERNAL_SERVER = process.env.PLAYWRIGHT_BASE_URL;
const BASE_URL = EXTERNAL_SERVER ?? 'http://localhost:4173';

export default defineConfig({
	testDir: './src/tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'html',
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	// When PLAYWRIGHT_BASE_URL is set the tests run against an already-running
	// dev server (that is what `./dev.sh test` does); otherwise Playwright
	// starts its own on port 4173, which is what CI relies on.
	...(EXTERNAL_SERVER
		? {}
		: {
				webServer: {
					command: 'npm run dev -- --port 4173',
					url: 'http://localhost:4173',
					reuseExistingServer: !process.env.CI,
					env: {
						TEST_MODE: '1',
						MONGODB_DATABASE: 'prismo'
					}
				}
			})
});
