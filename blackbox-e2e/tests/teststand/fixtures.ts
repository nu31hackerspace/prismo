/**
 * Playwright fixture that provides a page signed in through the real Google
 * OAuth flow (email + password + TOTP second factor), see lib/google-login.ts.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { googleLogin } from "./lib/google-login";

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await googleLogin(page);
    await expect(page.locator("h1", { hasText: "My Devices" })).toBeVisible({
      timeout: 15_000,
    });
    await use(page);
  },
});

export { expect };
