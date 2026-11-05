/**
 * Playwright fixture that provides a page signed in as the test user. The
 * user is seeded straight into the stack's database and the session cookie
 * minted locally (see lib/session.ts), as if they had signed up with Google
 * earlier — the suite never talks to Google.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { signIn } from "./lib/session";

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await signIn(page.context());
    await page.goto("/devices");
    await expect(page.locator("h1", { hasText: "My Devices" })).toBeVisible({
      timeout: 15_000,
    });
    await use(page);
  },
});

export { expect };
