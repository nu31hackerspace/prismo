import { defineConfig, devices } from '@playwright/test';
import { config as standConfig } from './tests/teststand/lib/env';

// NOTE: deliberately no dotenv here. Unlike playwright.config.ts, this suite is
// configured explicitly via the orchestrator / shell env (see lib/env.ts), so a
// developer's web/.env (which points at their dev VM with a different
// SESSION_SECRET) can't silently override the stand's settings.

/**
 * Playwright config for the hardware test-stand suite.
 *
 * Unlike playwright.config.ts (which boots a `vite dev` webServer), this targets
 * the already-running production stack (blackbox-e2e compose) and never starts
 * its own server. Run it via the orchestrator: `npm run teststand:run`, or on
 * its own against a live stack: `npm run teststand:test`.
 */
export default defineConfig({
	testDir: './tests/teststand',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list'], ['html', { open: 'never' }]],
	// Hardware steps (flash + boot + GPIO) are slow; give each test room.
	timeout: 180_000,
	use: {
		baseURL: standConfig.baseUrl,
		headless: false,
		video: 'retain-on-failure',
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: ['--no-sandbox', '--disable-setuid-sandbox']
				}
			}
		}
	]
});
