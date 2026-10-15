/**
 * Machine mode e2e test (hardware-in-the-loop).
 *
 * Only an allowed key turns the machine on, but any key turns it off:
 *   1. an allowed tag turns the machine on, it stays on for 60 seconds, and a
 *      tag the server has never seen turns it off;
 *   2. an allowed tag turns the machine on, it stays on for 60 seconds, and
 *      the same tag turns it off.
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
  signalStayedActive,
} from "./lib/gpio";
import { watchDeviceStatus, type StatusWatcher } from "./lib/status-watcher";
import { expectFirstOnline } from "./lib/reconnect-helpers";
import { TagEmulator } from "./lib/tag-emulator";
import { flashAppFirmware, configureForStand } from "./lib/stand-device";
import {
  grantKeys,
  deleteKeys,
  keysChecksum,
  tagUidRange,
  type StandKey,
} from "./lib/keys";
import { config } from "./lib/env";

const MACHINE_ON_HOLD_MS = 60_000;

test("machine mode: allowed key turns on, any key turns off", async ({
  page,
}) => {
  test.setTimeout(900_000);

  let watcher: StatusWatcher | undefined;
  let emulator: TagEmulator | undefined;
  let keys: StandKey[] = [];
  const deviceName = `Stand Machine ${Date.now()}`;
  const [allowedTagUid, unknownTagUid] = tagUidRange(2);

  const turnOnAndHold = async () => {
    expect(await waitForSignalInactive(10_000)).toBe(true);
    await emulator!.emulate(allowedTagUid);
    expect(await waitForSignalActive(), "allowed tag did not turn on").toBe(
      true,
    );
    await emulator!.waitForStop();
    expect(
      await signalStayedActive(MACHINE_ON_HOLD_MS),
      "machine turned off on its own",
    ).toBe(true);
  };

  const expectTapTurnsOff = async (tagUid: string) => {
    await emulator!.emulate(tagUid);
    expect(await waitForSignalInactive(), "tag did not turn off").toBe(true);
    await emulator!.waitForStop();
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

    await test.step("Flash the app's firmware and configure machine mode", async () => {
      await flashAppFirmware(page, test.info());
      await configureForStand(creds, "machine");
    });

    await test.step("Provision the PN532 tag emulator", async () => {
      emulator = new TagEmulator();
      await emulator.provision();
    });

    await test.step("Device comes Online and syncs the allowed key", async () => {
      await expectFirstOnline(page);
      keys = await grantKeys(page, deviceId, [allowedTagUid], deviceName);
      await watcher!.waitForKeysChecksum(
        keysChecksum(keys.map((k) => k.uidHash)),
        config.keySyncTimeoutMs,
      );
    });

    await test.step("Allowed tag turns on, unknown tag turns off after 60 s", async () => {
      await turnOnAndHold();
      await expectTapTurnsOff(unknownTagUid);
    });

    await test.step("Allowed tag turns on, same tag turns off after 60 s", async () => {
      await turnOnAndHold();
      await expectTapTurnsOff(allowedTagUid);
    });
  } finally {
    await emulator?.close();
    await watcher?.close();
    await deleteKeys(page, keys);
  }
});
