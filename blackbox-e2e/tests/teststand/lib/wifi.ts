/**
 * WiFi hotspot control for the reconnection specs.
 *
 * The Pi serves the AP the device joins (NetworkManager profile `prismo-ap`,
 * created by firmware/tests/real_hardware/start-ap.sh). Taking the connection
 * down kills the device's WiFi link while the Pi keeps its Ethernet uplink,
 * the docker stack and the USB serial port — exactly the "AP power loss" case.
 *
 * Requires passwordless sudo for nmcli (the CI runner has it; locally run the
 * suite via `sudo -E npm run teststand:run` or add an NOPASSWD rule).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./env";
import { run } from "./exec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Take the AP down: the device loses WiFi within seconds. */
export async function apDown(): Promise<void> {
  await run("sudo", ["nmcli", "connection", "down", config.apProfileName]);
}

/** True while NetworkManager has the hotspot profile active on the WiFi interface. */
async function isApActive(): Promise<boolean> {
  const { stdout } = await run(
    "nmcli",
    ["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"],
    { check: false },
  );
  return stdout
    .split("\n")
    .some((l) => l.trim() === `${config.apProfileName}:${config.wifiIface}`);
}

interface RadioInfo {
  type?: string;
  ssid?: string;
  channel?: string;
}

/**
 * Radio state from `iw dev <iface> info`; NetworkManager can report the hotspot
 * active while the device still can't see it. Null when iw is unavailable.
 */
async function radioInfo(): Promise<RadioInfo | null> {
  const { stdout } = await run("iw", ["dev", config.wifiIface, "info"], {
    check: false,
  });
  const pick = (re: RegExp) => stdout.match(re)?.[1]?.trim();
  const info = {
    type: pick(/^\s*type (\S+)/m),
    ssid: pick(/^\s*ssid (.+)$/m),
    channel: pick(/^\s*channel (\d+)/m),
  };
  return info.type ? info : null;
}

async function logRadio(): Promise<void> {
  const info = await radioInfo();
  console.log(
    info
      ? `AP radio: type=${info.type} ssid=${info.ssid} channel=${info.channel}`
      : "AP radio: iw not available, state unknown",
  );
}

/** Poll until the radio is in AP mode and serving our SSID (or iw can't tell). */
async function waitForApServing(timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    const info = await radioInfo();
    if (!info) return true; // iw unavailable
    if (info.type === "AP" && info.ssid === config.wifiSsid) return true;
    await sleep(1_000);
  } while (Date.now() < deadline);
  return false;
}

/** Recreate the hotspot from scratch via start-ap.sh (the job's own bring-up). */
export async function restartAp(): Promise<void> {
  await run("bash", [path.resolve(repoRoot, config.startApScript)]);
  await logRadio();
}

/**
 * Bring the AP back. `connection down` keeps the profile, so `connection up`
 * is the fast path; on any failure (missing profile, stuck interface) fall
 * back to the full start-ap.sh, which is idempotent and recreates the
 * profile. If that fails too, the error propagates — a stand without its
 * hotspot must fail loudly, not silently.
 *
 * An already-active AP is left alone (re-activating only bounces it), and the
 * radio is verified to be serving the SSID before returning.
 */
export async function apUp(): Promise<void> {
  if (!(await isApActive())) {
    try {
      await run("sudo", [
        "nmcli",
        "connection",
        "up",
        config.apProfileName,
        "ifname",
        config.wifiIface,
      ]);
    } catch {
      await restartAp();
      return;
    }
  }
  if (!(await waitForApServing())) {
    console.warn(
      `AP profile ${config.apProfileName} is active but ${config.wifiIface} is not serving ${config.wifiSsid}; recreating it`,
    );
    await restartAp();
    return;
  }
  await logRadio();
}

/**
 * Best-effort AP restore for finally blocks: never throws, so a failing spec
 * can't leave the stand without its hotspot (which would cascade into every
 * later spec).
 */
export async function ensureApUp(): Promise<void> {
  try {
    await apUp();
  } catch (err) {
    console.error("ensureApUp failed (stand may need manual AP restore):", err);
  }
}
