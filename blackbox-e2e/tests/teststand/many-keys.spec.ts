/**
 * Large allowlist e2e test (hardware-in-the-loop).
 *
 * Grants a large batch of keys (TESTSTAND_MANY_KEYS_COUNT, default 50) to a
 * freshly flashed device and verifies the whole system keeps up:
 *
 *   1. the UI lists every granted key on the device page;
 *   2. the device converges on the full allowlist despite the burst of
 *      cmd/sync republishes (one per grant, each carrying the whole list) —
 *      proven by the keys_checksum in its heartbeat matching the server's set;
 *   3. tags from the start, middle and end of the list open the door over
 *      real RF, while a tag outside the list is denied;
 *   4. revoking a batch of keys shrinks the device's allowlist accordingly:
 *      a revoked tag is denied, a remaining one still opens the door;
 *   5. the large allowlist survives a reboot with no AP: it is loaded back
 *      from flash and opens the door offline, and once reconnected the
 *      heartbeat reports the expected checksum.
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
import { firstHeartbeat } from "./lib/reconnect-helpers";
import { TagEmulator } from "./lib/tag-emulator";
import { flashAppFirmware, configureForStand } from "./lib/stand-device";
import {
  grantKeys,
  revokeKeys,
  deleteKeys,
  keysChecksum,
  tagUidRange,
  type StandKey,
} from "./lib/keys";
import { config } from "./lib/env";
import { run } from "./lib/exec";

test("many keys: bulk grant, device allowlist convergence, NFC access, bulk revoke, and persistence across reboot", async ({
  page,
}) => {
  test.setTimeout(900_000);

  let watcher: StatusWatcher | undefined;
  let emulator: TagEmulator | undefined;
  let keys: StandKey[] = [];
  const deviceName = `Stand Many Keys ${Date.now()}`;
  const labelPrefix = `Bulk Tag ${Date.now()}`;
  // One extra UID past the granted range: never added, so always unknown.
  const tagUids = tagUidRange(config.manyKeysCount + 1);
  const unknownTagUid = tagUids.pop()!;
  const allowedKeys = page.locator("[data-allowed-key-id]");
  const checksumOf = (ks: StandKey[]) => keysChecksum(ks.map((k) => k.uidHash));

  const expectTagOpensDoor = async (key: StandKey) => {
    expect(await waitForSignalInactive(10_000)).toBe(true);
    await emulator!.emulate(key.tagUid);
    expect(
      await waitForSignalActive(),
      `door pin did not fire for ${key.label}`,
    ).toBe(true);
    await emulator!.waitForStop();
    expect(await waitForSignalInactive(10_000)).toBe(true);
  };

  const expectScanInHistory = async (verdict: string, label: string) => {
    await expect(
      page
        .locator("li")
        .filter({ hasText: verdict })
        .filter({ hasText: label })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  };

  try {
    const { deviceId, creds } =
      await test.step("Create device and generate MQTT credentials", async () => {
        await createDevice(page, deviceName);
        const deviceId = await navigateToDevice(page, deviceName);
        return {
          deviceId,
          creds: await generateMqttCredentials(page, deviceId),
        };
      });

    watcher = await watchDeviceStatus(creds);

    await test.step("Flash the app's firmware and configure WiFi + MQTT", async () => {
      await flashAppFirmware(page, test.info());
      await configureForStand(creds);
    });

    await test.step("Provision the PN532 tag emulator", async () => {
      emulator = new TagEmulator();
      await emulator.provision();
    });

    await test.step("Device comes Online with an empty allowlist", async () => {
      await expect(page.getByText("Online", { exact: true })).toBeVisible({
        timeout: config.onlineTimeoutMs,
      });
      const sample = await firstHeartbeat(
        watcher!,
        Date.now() - config.onlineTimeoutMs,
      );
      expect(
        sample.keysChecksum,
        "fresh device reports a non-empty allowlist",
      ).toBe(keysChecksum([]));
      await expect(allowedKeys).toHaveCount(0);
    });

    await test.step(`Grant ${config.manyKeysCount} keys → UI lists all, device allowlist converges`, async () => {
      keys = await grantKeys(page, deviceId, tagUids, labelPrefix);
      await expect(allowedKeys).toHaveCount(config.manyKeysCount, {
        timeout: 30_000,
      });
      await watcher!.waitForKeysChecksum(
        checksumOf(keys),
        config.keySyncTimeoutMs,
      );
      // Steady state: the checksum must hold, not flap back to a partial list.
      await page.waitForTimeout(12_000);
      expect(watcher!.latest()?.keysChecksum).toBe(checksumOf(keys));
    });

    await test.step("Tags across the allowlist open the door", async () => {
      const middle = keys[Math.floor(keys.length / 2)];
      for (const key of [keys[0], middle, keys[keys.length - 1]]) {
        await expectTagOpensDoor(key);
        await expectScanInHistory("Allowed", key.label);
      }
    });

    await test.step("A tag outside the allowlist is denied", async () => {
      expect(await waitForSignalInactive(10_000)).toBe(true);
      await emulator!.emulate(unknownTagUid);
      await expect(
        page.getByRole("heading", { name: "Unknown key scanned" }),
      ).toBeVisible({ timeout: 30_000 });
      await emulator!.waitForStop();
      expect(await signalStayedInactive(6_000)).toBe(true);
    });

    const revokeCount = Math.max(1, Math.floor(keys.length / 5));
    const revoked = keys.slice(0, revokeCount);
    const remaining = keys.slice(revokeCount);

    await test.step(`Revoke ${revokeCount} keys → device shrinks its allowlist`, async () => {
      await revokeKeys(page, revoked);
      await expect(allowedKeys).toHaveCount(remaining.length, {
        timeout: 30_000,
      });
      for (const key of revoked) {
        await expect(
          page.locator(`[data-allowed-key-id="${key.uidHash}"]`),
        ).toHaveCount(0);
      }
      await watcher!.waitForKeysChecksum(
        checksumOf(remaining),
        config.keySyncTimeoutMs,
      );
    });

    await test.step("Revoked tag is denied, a remaining tag still opens the door", async () => {
      expect(await waitForSignalInactive(10_000)).toBe(true);
      await emulator!.emulate(revoked[0].tagUid);
      // The key entity still exists after revoking, so the denied scan is named.
      await expectScanInHistory("Denied", `· ${revoked[0].label}`);
      await emulator!.waitForStop();
      expect(await signalStayedInactive(6_000)).toBe(true);

      await expectTagOpensDoor(remaining[remaining.length - 1]);
    });

    await test.step("Allowlist persists across a reboot with no AP", async () => {
      await apDown();
      await run(config.mpremoteBin, ["connect", config.serialPort, "reset"]);
      const resetAt = Date.now();
      await page.waitForTimeout(config.bootOfflineGraceMs);
      await expect(page.getByText("Offline", { exact: true })).toBeVisible();

      // No backend reachable: only the allowlist reloaded from flash can open the door.
      await expectTagOpensDoor(remaining[Math.floor(remaining.length / 2)]);

      await apUp();
      await expect(page.getByText("Online", { exact: true })).toBeVisible({
        timeout: config.reconnectTimeoutMs,
      });
      const sample = await watcher!.waitForSample(resetAt, 30_000);
      expect(
        sample.keysChecksum,
        "device allowlist after reboot differs from the set synced before it",
      ).toBe(checksumOf(remaining));
    });
  } finally {
    await ensureApUp();
    await waitForSignalInactive(10_000).catch(() => undefined);
    await emulator?.close();
    await watcher?.close();
    await deleteKeys(page, keys);
  }
});
