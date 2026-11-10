import { test, expect } from "./fixtures";
import { config } from "./lib/env";

test("seeded session is accepted by the backend as the test user", async ({
  page,
}) => {
  const me = await page.request.get("/api/auth/me");
  expect(me.ok()).toBe(true);
  const body = await me.json();
  expect(body.user.email).toBe(config.testUserEmail);
  expect(body.workspaceId).toBeTruthy();
});
