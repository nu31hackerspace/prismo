/**
 * Bring-up shared by the hardware specs: flash the app's own firmware onto
 * the device under test and point it at the stand's hotspot + broker.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { execSync } from "child_process";
import { statSync } from "node:fs";
import type { MqttCredentials } from "../../helpers";
import { configureDevice } from "./device-config";
import { config } from "./env";

/**
 * Download the firmware through the device page's "Download Firmware" button
 * (the page must already be on a device's detail view) and flash it via esptool.
 */
export async function flashAppFirmware(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download Firmware" }).click();
  const download = await downloadPromise;
  expect(await download.failure(), "firmware download failed").toBeNull();
  const fwPath = testInfo.outputPath("firmware.bin");
  await download.saveAs(fwPath);
  expect(statSync(fwPath).size, "downloaded firmware is empty").toBeGreaterThan(
    0,
  );

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
