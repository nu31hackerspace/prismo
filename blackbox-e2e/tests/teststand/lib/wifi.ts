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

/** Take the AP down: the device loses WiFi within seconds. */
export async function apDown(): Promise<void> {
  await run("sudo", ["nmcli", "connection", "down", config.apProfileName]);
}

/**
 * Bring the AP back. `connection down` keeps the profile, so `connection up`
 * is the fast path; on any failure (missing profile, stuck interface) fall
 * back to the full start-ap.sh, which is idempotent and recreates the
 * profile. If that fails too, the error propagates — a stand without its
 * hotspot must fail loudly, not silently.
 */
export async function apUp(): Promise<void> {
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
    await run("bash", [path.resolve(repoRoot, config.startApScript)]);
  }
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
