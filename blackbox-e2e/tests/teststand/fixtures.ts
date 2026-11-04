/**
 * Playwright fixture that provides a page signed in through the real Google
 * OAuth flow (email + password + optional TOTP second factor), see
 * lib/google-login.ts.
 *
 * The Google sign-in runs once per test run, not once per test: every test
 * gets a fresh browser context, and Google treats each fresh context as a new
 * device. Several "new device" sign-ins within minutes make Google escalate to
 * extra verification (method picker, phone prompts) and the run fails at the
 * login step instead of at anything the suite actually tests. So the first
 * test signs in for real and the app's session cookie is reused by the rest.
 *
 * Only the app's own cookies are cached (never Google's), and they live in the
 * OS temp dir keyed by the Playwright runner process, so they survive worker
 * restarts after a failed test but not the run, and are never uploaded with
 * the report artifacts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { googleLogin } from "./lib/google-login";
import { config } from "./lib/env";

type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;

const sessionFile = path.join(
  os.tmpdir(),
  `prismo-teststand-session-${process.ppid}.json`,
);

function loadSession(): Cookies | undefined {
  try {
    return JSON.parse(fs.readFileSync(sessionFile, "utf8")) as Cookies;
  } catch {
    return undefined;
  }
}

function saveSession(cookies: Cookies): void {
  fs.writeFileSync(sessionFile, JSON.stringify(cookies), { mode: 0o600 });
}

async function isSignedIn(page: Page): Promise<boolean> {
  const me = await page.request.get("/api/auth/me").catch(() => undefined);
  return !!me?.ok();
}

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const cached = loadSession();
    if (cached) await page.context().addCookies(cached);

    if (cached && (await isSignedIn(page))) {
      await page.goto("/devices");
    } else {
      await page.context().clearCookies();
      await googleLogin(page);
      const appHost = new URL(config.baseUrl).hostname;
      saveSession(
        (await page.context().cookies()).filter((c) =>
          appHost.endsWith(c.domain.replace(/^\./, "")),
        ),
      );
    }

    await expect(page.locator("h1", { hasText: "My Devices" })).toBeVisible({
      timeout: 15_000,
    });
    await use(page);
  },
});

export { expect };
