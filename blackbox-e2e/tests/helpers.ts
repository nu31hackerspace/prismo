import mqtt from "mqtt";
import { expect, type Page } from "@playwright/test";
import {
  deviceTopic,
  SUBTOPICS,
  type StatusPayload,
  type ScanPayload,
} from "./contract";

export async function loginUser(page: Page): Promise<void> {
  await page.goto("/");
  await page.click('text="Sign In"');
  await expect(page).toHaveURL(/\/devices$/, { timeout: 10_000 });
  await expect(page.locator("h1", { hasText: "My Devices" })).toBeVisible({
    timeout: 10_000,
  });
}

export type MqttCredentials = {
  mqttUser: string;
  mqttPass: string;
};

export async function createDevice(
  page: Page,
  deviceName: string,
  mode: "door" | "machine" = "door",
): Promise<void> {
  await expect(page.locator('form[action="?/addDevice"]')).toBeVisible();
  await page.fill('input[name="name"]', deviceName);
  await page.selectOption('select[name="mode"]', mode);
  await page.click('button:has-text("Add Device")');
  await expect(page.locator(`h3:has-text("${deviceName}")`)).toBeVisible();
}

export async function navigateToDevice(
  page: Page,
  deviceName: string,
): Promise<void> {
  const deviceCard = page.locator(`h3:has-text("${deviceName}")`).locator("..");
  await deviceCard.locator('a:has-text("Manage")').click();
  await expect(
    page.locator(`nav span:has-text("${deviceName}")`),
  ).toBeVisible();
}

export async function generateMqttCredentials(
  page: Page,
): Promise<MqttCredentials> {
  await page.click('button:has-text("Generate Token")');
  const mqttCredsAlert = page
    .locator("div", { hasText: "New MQTT Credentials Generated" })
    .first();
  await expect(mqttCredsAlert).toBeVisible();

  const rawText = (await mqttCredsAlert.textContent()) ?? "";
  const mqttUser = rawText.match(/Username:\s*([^\s]+)/)?.[1] ?? "";
  const mqttPass = rawText.match(/Password:\s*([^\s]+)/)?.[1] ?? "";

  expect(mqttUser).toBeTruthy();
  expect(mqttPass).toBeTruthy();

  return { mqttUser, mqttPass };
}

export async function publishDeviceStatus(
  mqttUrl: string,
  credentials: MqttCredentials,
  online: boolean,
): Promise<void> {
  const { mqttUser, mqttPass } = credentials;
  const client = mqtt.connect(mqttUrl, {
    username: mqttUser.trim(),
    password: mqttPass.trim(),
    clientId: `ui-test-status-${Date.now()}`,
  });

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => {
      client.publish(
        deviceTopic(mqttUser.trim(), SUBTOPICS.status),
        JSON.stringify({ online } satisfies StatusPayload),
        { qos: 1 },
        (err: Error | undefined) => {
          client.end();
          if (err) reject(err);
          else resolve();
        },
      );
    });
    client.once("error", reject);
  });
}

export type ScanOptions = { allowed?: boolean; machineActive?: boolean };

export async function publishScan(
  mqttUrl: string,
  credentials: MqttCredentials,
  uid: string,
  opts: ScanOptions = {},
): Promise<void> {
  const { mqttUser, mqttPass } = credentials;
  const payload: ScanPayload = {
    uid,
    allowed: opts.allowed ?? false,
  };
  if (opts.machineActive !== undefined)
    payload.machine_active = opts.machineActive;

  const client = mqtt.connect(mqttUrl, {
    username: mqttUser.trim(),
    password: mqttPass.trim(),
    clientId: `ui-test-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => {
      client.publish(
        deviceTopic(mqttUser.trim(), SUBTOPICS.scan),
        JSON.stringify(payload),
        { qos: 1 },
        (err: Error | undefined) => {
          client.end();
          if (err) reject(err);
          else resolve();
        },
      );
    });
    client.once("error", reject);
  });
}

export async function navigateToKeys(page: Page): Promise<void> {
  await page.goto("/keys");
  await expect(page.locator("h1", { hasText: "Keys" })).toBeVisible();
}

export function requireMqttUrl(): string {
  const url = process.env.MQTT_URL;
  if (!url) throw new Error("MQTT_URL env var is required for E2E testing");
  return url;
}
