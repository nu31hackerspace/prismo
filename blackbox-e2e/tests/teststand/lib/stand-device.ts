/**
 * Bring-up shared by the hardware specs: flash the app's own firmware.bin onto
 * the device under test and point it at the stand's hotspot + broker.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { execSync } from "child_process";
import { writeFileSync } from "node:fs";
import type { MqttCredentials } from "../../helpers";
import { configureDevice } from "./device-config";
import { config } from "./env";

/** Download /firmware.bin from the app under test and flash it via esptool. */
export async function flashAppFirmware(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const res = await page.request.get("/firmware.bin");
  expect(res.ok(), "app does not serve /firmware.bin").toBe(true);
  const fwPath = testInfo.outputPath("firmware.bin");
  writeFileSync(fwPath, await res.body());

  console.log(`Flashing ${fwPath} to ${config.serialPort} via esptool…`);
  execSync(
    `${config.esptoolBin} --chip esp32c3 --port ${config.serialPort} erase_flash`,
    { stdio: "inherit" },
  );
  execSync(
    `${config.esptoolBin} --chip esp32c3 --port ${config.serialPort} --baud 460800 write_flash 0x0 ${fwPath}`,
    { stdio: "inherit" },
  );
}

/** Write the stand's WiFi + MQTT settings over the serial @cfg protocol. */
export async function configureForStand(creds: MqttCredentials): Promise<void> {
  await configureDevice({
    wifi_ssid: config.wifiSsid,
    wifi_pass: config.wifiPass,
    mqtt_url: `mqtt://${config.deviceMqttHost}:${config.deviceMqttPort}`,
    mqtt_user: creds.mqttUser,
    mqtt_pass: creds.mqttPass,
    mode: "door",
  });
}
