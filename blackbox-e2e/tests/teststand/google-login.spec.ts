import { test, expect } from "./fixtures";
import { totp } from "./lib/google-login";
import { config } from "./lib/env";

test("TOTP matches RFC 6238 test vector", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  expect(totp(rfcSecret, 59_000)).toBe("287082");
  expect(totp(rfcSecret, 1_111_111_109_000)).toBe("081804");
});

test("real Google login creates a session for the Google account", async ({
  page,
}) => {
  const me = await page.request.get("/api/auth/me");
  expect(me.ok()).toBe(true);
  expect((await me.json()).user.email).toBe(config.googleEmail);
});
