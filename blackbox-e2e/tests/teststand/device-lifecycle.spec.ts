/**
 * Full device lifecycle + connectivity-recovery e2e test (hardware-in-the-loop).
 *
 * Drives the production web app as a user would — create a device, generate
 * its MQTT credentials, download the app's firmware.bin and flash the real
 * ESP32-C3 with esptool, then write WiFi/MQTT settings over the serial @cfg
 * protocol (what "Setup Device" does over Web Serial) — and verifies the live
 * device:
 *
 *   1. comes Online and the "Open Door" button drives the physical pin;
 *   2. denies an unknown NFC tag presented over real RF by the PN532 tag
 *      emulator (second ESP32-C3, see blackbox-e2e/tag-emulator), surfaces it
 *      in the UI, and opens the door once the operator adds the key — the
 *      whole path is the production one: RF → PN532 → sha256 → MQTT → UI;
 *   3. survives a WiFi AP outage: the Pi hotspot is switched off and back on,
 *      and the device reconnects on its own without rebooting — and while the
 *      backend is away, the authorized tag still opens the door from the
 *      device-local allowlist;
 *   4. survives a broker outage: the MQTT container is stopped and restarted;
 *   5. connects for the first time after booting with no AP present (the AP is
 *      switched off, the board is reset, then the AP is switched back on);
 *   6. denies the tag again once its key is removed through the UI.
 *
 * "Without rebooting" is proven by the uptime_s field in the device heartbeat
 * staying monotonic across each outage (a watchdog reset would restart it).
 * The whole run uses one flash — the phases share the flashed device.
 */
import { test, expect } from "./fixtures";
import {
  createDevice,
  navigateToDevice,
  generateMqttCredentials,
} from "../helpers";
import {
  waitForSignalActive,
  waitForSignalInactive,
  signalStayedInactive,
} from "./lib/gpio";
import { apDown, apUp, ensureApUp } from "./lib/wifi";
import { watchDeviceStatus, type StatusWatcher } from "./lib/status-watcher";
import {
  firstHeartbeat,
  expectTriggerReachesPin,
  expectReconnectCycle,
} from "./lib/reconnect-helpers";
import { TagEmulator } from "./lib/tag-emulator";
import { flashAppFirmware, configureForStand } from "./lib/stand-device";
import { config } from "./lib/env";
import { run } from "./lib/exec";

test("device lifecycle: flash, configure, online, trigger, NFC tag access, and reconnect after WiFi/broker/boot outages", async ({
  page,
}) => {
  // esptool flash + boot/online waits + three reconnection cycles.
  test.setTimeout(900_000);

  let watcher: StatusWatcher | undefined;
  let emulator: TagEmulator | undefined;
  const deviceName = `Stand Device ${Date.now()}`;
  // 3-byte NFCID1 the emulator radiates; timestamp-derived so a rerun never
  // collides with a key the org already knows. The reader sees UID 08<this>,
  // hashes it, and that hash is all the backend/UI ever handles.
  const tagUid = Date.now().toString(16).slice(-6).padStart(6, "0");
  const tagName = `Stand Tag ${Date.now()}`;

  try {
    const creds =
      await test.step("Create device and generate MQTT credentials", async () => {
        await createDevice(page, deviceName);
        const deviceId = await navigateToDevice(page, deviceName);
        await expect(page.getByText("Offline", { exact: true })).toBeVisible({
          timeout: 5_000,
        });
        return generateMqttCredentials(page, deviceId);
      });

    // Watch the device's heartbeats from the broker's published port (this
    // path never crosses wlan0, so it survives the AP outages below).
    watcher = await watchDeviceStatus(creds);

    await test.step("Download the app's firmware and flash it via esptool", async () => {
      await flashAppFirmware(page, test.info());
    });

    await test.step("Write WiFi + MQTT settings over serial", async () => {
      await configureForStand(creds);
    });

    await test.step("Provision the PN532 tag emulator", async () => {
      emulator = new TagEmulator();
      await emulator.provision();
    });

    await test.step("Device comes Online and the success button drives the pin", async () => {
      await expect(page.getByText("Online", { exact: true })).toBeVisible({
        timeout: config.onlineTimeoutMs,
      });
      await firstHeartbeat(watcher!, Date.now() - config.onlineTimeoutMs);
      await expectTriggerReachesPin(page);
    });

    const scannedKeyId =
      await test.step("Unknown tag is denied and surfaces in the UI", async () => {
        expect(await waitForSignalInactive(10_000)).toBe(true);
        await emulator!.emulate(tagUid);
        // The device publishes the denied scan; it reaches the page via the sync socket.
        await expect(
          page.getByRole("heading", { name: "Unknown key scanned" }),
        ).toBeVisible({
          timeout: 30_000,
        });
        const keyId = (
          await page
            .getByText(/^[0-9a-f]{64}$/)
            .first()
            .textContent()
        )?.trim();
        expect(keyId, "unauthorized-scan panel shows no key hash").toBeTruthy();
        // A denied scan must never drive the door pin. Watch past the end of
        // the emulation window plus the 5s a wrongly-fired success would hold.
        await emulator!.waitForStop();
        expect(await signalStayedInactive(6_000)).toBe(true);
        return keyId!;
      });

    await test.step("Key added through the UI → the same tag opens the door", async () => {
      await page.getByPlaceholder("Name (e.g. Alice)").fill(tagName);
      await page.getByRole("button", { name: "Grant access" }).click();
      await expect(
        page.locator(`[data-allowed-key-id="${scannedKeyId}"]`),
      ).toBeVisible();
      // cmd/add_key is published on submit; give it a beat to reach the device.
      await page.waitForTimeout(2_000);
      await emulator!.emulate(tagUid);
      expect(
        await waitForSignalActive(),
        "door pin did not fire for the freshly authorized tag",
      ).toBe(true);
      // The allowed scan lands in the history with the operator-given name.
      await expect(
        page
          .locator("li")
          .filter({ hasText: "Allowed" })
          .filter({ hasText: tagName })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      // Let the emulation window end and the 5s success hold drain so the
      // next phase starts from an idle pin.
      await emulator!.waitForStop();
      expect(await waitForSignalInactive(10_000)).toBe(true);
    });

    await test.step("WiFi AP outage → offline scan still opens the door, device reconnects without rebooting", async () => {
      await expectReconnectCycle(page, watcher!, apDown, apUp, async () => {
        // The backend is unreachable: the door must open from the local
        // allowlist alone (and the reader must survive the failed publish).
        expect(await waitForSignalInactive(10_000)).toBe(true);
        await emulator!.emulate(tagUid);
        expect(
          await waitForSignalActive(),
          "door pin did not fire from the offline allowlist",
        ).toBe(true);
        await emulator!.waitForStop();
        await waitForSignalInactive(10_000);
      });
    });

    await test.step("Broker outage → device reconnects MQTT without rebooting", async () => {
      await expectReconnectCycle(
        page,
        watcher!,
        () =>
          run("docker", ["stop", config.mqttContainer]).then(() => undefined),
        () =>
          run("docker", ["start", config.mqttContainer]).then(() => undefined),
      );
    });

    await test.step("Boot with no AP → device makes its first connection when the AP appears", async () => {
      await apDown();
      // Reboot the board while its AP is gone: the blocking boot connect
      // fails, the reader loop starts offline, and runtime maintenance owns
      // the (first) connection from then on.
      await run(config.mpremoteBin, ["connect", config.serialPort, "reset"]);
      await page.waitForTimeout(config.bootOfflineGraceMs);
      await expect(page.getByText("Offline", { exact: true })).toBeVisible();

      await apUp();
      await expect(page.getByText("Online", { exact: true })).toBeVisible({
        timeout: config.reconnectTimeoutMs,
      });
      await expectTriggerReachesPin(page);
    });

    await test.step("Removed key is denied again", async () => {
      await page
        .locator(`[data-allowed-key-id="${scannedKeyId}"]`)
        .getByRole("button", { name: "Remove" })
        .click();
      await expect(
        page.locator(`[data-allowed-key-id="${scannedKeyId}"]`),
      ).not.toBeVisible();
      // cmd/remove_key is published on submit; give it a beat to reach the device.
      await page.waitForTimeout(2_000);
      await emulator!.emulate(tagUid);
      // The org key still exists after detaching, so this denied scan carries
      // the name — assert on the history entry (the unauthorized-scan panel
      // only reacts to nameless scans).
      await expect(
        page
          .locator("li")
          .filter({ hasText: "Denied" })
          .filter({ hasText: `· ${tagName}` })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      await emulator!.waitForStop();
      expect(await signalStayedInactive(6_000)).toBe(true);
    });
  } finally {
    await ensureApUp(); // never leave the stand without its hotspot
    await run("docker", ["start", config.mqttContainer], { check: false });
    await waitForSignalInactive(10_000).catch(() => undefined);
    await emulator?.close();
    await watcher?.close();
  }
});
