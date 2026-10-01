import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const { config: standConfig } = await import("./tests/teststand/lib/env");

/**
 * Playwright config for the hardware test-stand suite.
 *
 * Unlike playwright.config.ts (which boots a `vite dev` webServer), this targets
 * the already-running production stack (blackbox-e2e compose) and never starts
 * its own server. Run it via the orchestrator: `npm run teststand:run`, or on
 * its own against a live stack: `npm run teststand:test`.
 */
export default defineConfig({
  testDir: "./tests/teststand",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  // Hardware steps (flash + boot + GPIO) are slow; give each test room.
  timeout: 180_000,
  use: {
    baseURL: standConfig.baseUrl,
    headless: true,
    // Local runs hit the dev stack's Caddy, which serves a self-signed cert.
    ignoreHTTPSErrors: true,
    locale: "en-US",
    // Keep video + trace for every run (pass or fail) for max diagnostics.
    video: "on",
    trace: "on",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
});
