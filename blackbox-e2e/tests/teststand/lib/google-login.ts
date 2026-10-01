import crypto from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { config } from "./env";

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.toUpperCase().replace(/[\s=]/g, "")) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error(`Invalid base32 character "${ch}"`);
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = crypto
    .createHmac("sha1", base32Decode(secret))
    .update(counter)
    .digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

async function freshTotp(secret: string): Promise<string> {
  const msLeft = 30_000 - (Date.now() % 30_000);
  if (msLeft < 5_000) await new Promise((r) => setTimeout(r, msLeft + 500));
  return totp(secret);
}

export async function googleLogin(page: Page): Promise<void> {
  const { googleEmail, googlePassword, googleTotpSecret } = config;
  if (!googleEmail || !googlePassword) {
    throw new Error("Set TESTSTAND_GOOGLE_EMAIL and TESTSTAND_GOOGLE_PASSWORD");
  }

  await page.goto("/");
  await page.getByRole("link", { name: "Sign In" }).first().click();

  await page.getByRole("textbox", { name: "Email or phone" }).fill(googleEmail);
  await page.locator("#identifierNext").click();

  const password = page.locator('input[type="password"][name="Passwd"]');
  await password.waitFor({ timeout: 30_000 });
  await password.fill(googlePassword);
  await page.locator("#passwordNext").click();

  // Google asks for the second factor only when it decides the sign-in is
  // risky, so the TOTP prompt is optional: handle whatever page shows up
  // (authenticator challenge, method picker, consent) until we land back on
  // the app.
  const appOrigin = new URL(config.baseUrl).origin;
  const totpInput = page.locator('input[name="totpPin"]');
  const authenticatorOption = page.getByText(/Google Authenticator/i);
  const tryAnotherWay = page.getByRole("button", { name: /Try another way/i });
  const consent = page.getByRole("button", { name: /^(Continue|Allow)$/ });
  const visible = (l: { first(): { isVisible(): Promise<boolean> } }) =>
    l
      .first()
      .isVisible()
      .catch(() => false);
  let totpSubmitted = false;
  const deadline = Date.now() + 90_000;
  while (!page.url().startsWith(appOrigin)) {
    if (Date.now() > deadline) {
      throw new Error(`Google login stuck at ${page.url()}`);
    }
    if (!totpSubmitted && (await visible(totpInput))) {
      if (!googleTotpSecret) {
        throw new Error(
          "Google asked for an authenticator code: set TESTSTAND_GOOGLE_TOTP_SECRET",
        );
      }
      await totpInput.fill(await freshTotp(googleTotpSecret));
      await page.locator("#totpNext").click();
      totpSubmitted = true;
    } else if (
      googleTotpSecret &&
      !totpSubmitted &&
      (await visible(authenticatorOption))
    ) {
      // Challenge method picker: choose the authenticator app.
      await authenticatorOption
        .first()
        .click()
        .catch(() => {});
    } else if (
      googleTotpSecret &&
      !totpSubmitted &&
      page.url().includes("/challenge/") &&
      !page.url().includes("/challenge/totp") &&
      (await visible(tryAnotherWay))
    ) {
      // Google defaulted to another factor (phone prompt, SMS…).
      await tryAnotherWay
        .first()
        .click()
        .catch(() => {});
    } else if (await visible(consent)) {
      await consent
        .first()
        .click()
        .catch(() => {});
    }
    await page.waitForTimeout(500);
  }

  await expect(page).toHaveURL(/\/devices$/, { timeout: 15_000 });
}
