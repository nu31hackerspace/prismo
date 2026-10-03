import { expect, type Page } from "@playwright/test";

export type MqttCredentials = {
  mqttUser: string;
  mqttPass: string;
};

export async function createDevice(
  page: Page,
  deviceName: string,
): Promise<void> {
  await page.getByPlaceholder("Device name (e.g. Front Door)").fill(deviceName);
  await page.getByRole("button", { name: "Add Device" }).click();
  await expect(
    page.getByRole("heading", { name: deviceName, exact: true }),
  ).toBeVisible();
}

export async function navigateToDevice(
  page: Page,
  deviceName: string,
): Promise<string> {
  await page.getByRole("link").filter({ hasText: deviceName }).click();
  await expect(page).toHaveURL(/\/devices\/[^/]+$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Same call the "Fill MQTT credentials" button in Setup Device makes. */
export async function generateMqttCredentials(
  page: Page,
  deviceId: string,
): Promise<MqttCredentials> {
  const me = await page.request.get("/api/auth/me");
  const { workspaceId } = await me.json();
  // The client creates the device locally and syncs it to the backend in the
  // background, so right after "Add Device" the backend may not know it yet
  // ("Device not found"). Retry until the sync lands.
  let res = await requestToken(page, deviceId, workspaceId);
  const deadline = Date.now() + 15_000;
  while (!res.ok() && Date.now() < deadline) {
    await page.waitForTimeout(500);
    res = await requestToken(page, deviceId, workspaceId);
  }
  expect(res.ok(), "failed to generate MQTT credentials").toBe(true);
  const { token } = await res.json();
  return { mqttUser: token.mqttUser, mqttPass: token.mqttPass };
}

function requestToken(page: Page, deviceId: string, workspaceId: string) {
  return page.request.post(`/api/devices/${deviceId}/token`, {
    headers: { "X-Workspace": workspaceId },
  });
}
