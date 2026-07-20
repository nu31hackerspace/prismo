/**
 * Playwright fixture that provides an already-authenticated page by seeding a
 * session directly (the one allowed DB exception) and setting the `session`
 * cookie — skipping the Google OAuth flow without touching the app build.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { seedAuthSession } from "./lib/seed-auth";
import { config } from "./lib/env";

export const test = base.extend<{ page: Page }>({
  page: async ({ page, context }, use) => {
    const { token } = await seedAuthSession();
    const { hostname } = new URL(config.baseUrl);

    await context.addCookies([
      {
        name: "session",
        value: token,
        domain: hostname,
        path: "/",
        httpOnly: true,
        // We set the cookie ourselves over http://localhost, so it must not
        // be Secure-only (the app marks it Secure in prod, but reading it
        // server-side has no Secure requirement).
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/devices");
    await expect(page.locator("h1", { hasText: "My Devices" })).toBeVisible({
      timeout: 15_000,
    });

    await use(page);
  },
});

export { expect };
