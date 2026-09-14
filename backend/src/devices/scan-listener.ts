import mqtt from 'mqtt';
import { pool } from '@/db/pg';
import { mutate } from '@/db/mutate';
import { recordAction } from '@/db/actions';
import { findActive, findActiveGlobal } from '@/db/entities';
import type { ScanPayload } from '@/lib/mqtt-contract/mqtt-contract.generated';
import { SCAN_WILDCARD, STATUS_WILDCARD } from '@/lib/mqtt-contract/mqtt-contract.generated';

let initialized = false;

export function initializeScanListener(): void {
  console.log(`[scan-listener] initializeScanListener`);
  if (initialized) return;
  initialized = true;
  console.log(`[scan-listener] initializeScanListener real`);

  const url = process.env.MQTT_URL;
  if (!url) { console.warn('[scan-listener] MQTT_URL not set, skipping'); return; }
  const clientId = `prismo-scan-listener-${process.pid}`;

  const client = mqtt.connect(url, {
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    reconnectPeriod: 5_000,
    clientId,
  });

  client.on('connect', () => {
    console.log(`[scan-listener] connect`);
    client.subscribe([SCAN_WILDCARD, STATUS_WILDCARD], { qos: 1 });
  });

  client.on('message', (topic, payload) => {
    console.log(`[scan-listener] message on "${topic}": ${payload.toString()}`);
    const parts = topic.split('/');
    const subtopic = parts[2];
    if (subtopic === 'status') {
      handleHeartbeat(parts[1]).catch(err => console.error('[scan-listener] heartbeat error:', err));
    } else if (subtopic === 'scan') {
      handleScan(parts[1], payload).catch(err => console.error('[scan-listener] scan error:', err));
    }
  });
}

export async function handleHeartbeat(deviceSlug: string): Promise<void> {
  const device = await findActiveGlobal(pool, 'device', 'deviceSlug', deviceSlug);
  if (!device) return;

  await mutate(device.workspaceId, async (client, seq) => {
    const lastSeenAt = new Date().toISOString();
    await client.query(
      `UPDATE entities SET data = jsonb_set(data, '{lastSeenAt}', to_jsonb($1::text)),
              updated_rev = $2, updated_at = now()
       WHERE id = $3`,
      [lastSeenAt, seq, device.id]
    );
  });
}

async function handleScan(deviceSlug: string, rawPayload: Buffer): Promise<void> {
  let payload: ScanPayload;
  try {
    payload = JSON.parse(rawPayload.toString());
  } catch {
    console.error(`[scan-listener] malformed scan payload from "${deviceSlug}"`);
    return;
  }

  const device = await findActiveGlobal(pool, 'device', 'deviceSlug', deviceSlug);
  if (!device) return;

  const key = await findActive(pool, device.workspaceId, 'key', 'uidHash', payload.uid);

  await recordAction({
    workspaceId: device.workspaceId,
    deviceId: device.id,
    kind: 'scan',
    uidHash: payload.uid,
    keyId: key?.id ?? null,
    allowed: payload.allowed,
  });
}
