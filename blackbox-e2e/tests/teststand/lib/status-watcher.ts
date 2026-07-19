/**
 * Watches a device's MQTT status (heartbeat) topic during a spec.
 *
 * Connects to the broker's docker-published port on the test host — that path
 * does not cross wlan0, so the watcher stays connected while the specs kill
 * the device's WiFi. The device's own credentials may subscribe to
 * prismo/<user>/# (mosquitto dynsec role), and the unique clientId keeps the
 * watcher from kicking the device's session.
 *
 * The heartbeat carries `uptime_s` (seconds since device boot); its
 * monotonicity across an outage is the proof that the device *reconnected*
 * rather than rebooted (a watchdog reset would restart uptime near zero).
 */
import mqtt from "mqtt";
import { deviceTopic, SUBTOPICS, type StatusPayload } from "../../contract";
import type { MqttCredentials } from "../../helpers";
import { config } from "./env";

export interface StatusSample {
  receivedAt: number;
  online: boolean;
  uptimeS?: number;
}

export interface StatusWatcher {
  /** Most recent heartbeat seen, if any. */
  latest(): StatusSample | undefined;
  /** First heartbeat received at/after the given wall-clock ms. */
  waitForSample(afterMs: number, timeoutMs: number): Promise<StatusSample>;
  close(): Promise<void>;
}

export async function watchDeviceStatus(
  credentials: MqttCredentials,
): Promise<StatusWatcher> {
  const user = credentials.mqttUser.trim();
  const topic = deviceTopic(user, SUBTOPICS.status);
  const client = mqtt.connect(config.localMqttUrl, {
    username: user,
    password: credentials.mqttPass.trim(),
    clientId: `stand-status-watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  const samples: StatusSample[] = [];
  client.on("message", (t, payload) => {
    if (t !== topic) return;
    try {
      const data = JSON.parse(payload.toString()) as StatusPayload;
      samples.push({
        receivedAt: Date.now(),
        online: !!data.online,
        uptimeS: data.uptime_s,
      });
    } catch {
      // Ignore malformed payloads — the spec assertions will time out loudly.
    }
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    // Persistent handler: mqtt.js emits 'error' on every failed reconnect
    // attempt (e.g. while a spec stops the broker container), and an
    // unhandled 'error' event would crash the runner. After the initial
    // subscribe it only logs; mqtt.js keeps reconnecting on its own.
    client.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
        return;
      }
      console.warn(
        `status-watcher mqtt error (will auto-reconnect): ${err.message}`,
      );
    });
    client.once("connect", () => {
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      });
    });
  });

  return {
    latest: () => samples[samples.length - 1],
    async waitForSample(
      afterMs: number,
      timeoutMs: number,
    ): Promise<StatusSample> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = samples.find((s) => s.receivedAt >= afterMs);
        if (found) return found;
        if (Date.now() > deadline) {
          throw new Error(
            `No status heartbeat on ${topic} within ${timeoutMs}ms (samples seen: ${samples.length})`,
          );
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    },
    close: () =>
      new Promise<void>((resolve) => {
        client.end(false, {}, () => resolve());
      }),
  };
}
