import mqtt from 'mqtt';
import crypto from 'crypto';
import { pool } from '@/db/pg';
import { mutate } from '@/db/mutate';
import { recordAction } from '@/db/actions';
import type { UUID } from '@prismo/shared/entities';
import type { TypedEntityRow } from '@/db/entities';
import { pushDeviceSync } from '@/devices/device-service';
import type { ScanPayload, StatusPayload } from '@/lib/mqtt-contract/mqtt-contract.generated';
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
      handleHeartbeat(parts[1], payload).catch(err => console.error('[scan-listener] heartbeat error:', err));
    } else if (subtopic === 'scan') {
      handleScan(parts[1], payload).catch(err => console.error('[scan-listener] scan error:', err));
    }
  });
}

function computeKeysChecksum(uids: string[]): string {
  return crypto.createHash('sha256').update([...uids].sort().join(',')).digest('hex');
}

async function handleHeartbeat(deviceUuid: string, rawPayload: Buffer): Promise<void> {
  const { rows: [device] } = await pool.query<TypedEntityRow & { workspaceId: UUID }>(
    `SELECT id, type, workspace_id AS "workspaceId", data FROM entities
     WHERE id = $1 AND type = $2 AND deleted = false`,
    [deviceUuid, 'device'],
  );
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

  let payload: StatusPayload;
  try {
    payload = JSON.parse(rawPayload.toString());
  } catch {
    return;
  }
  if (typeof payload.keys_checksum !== 'string') return;

  const { rows } = await pool.query<{ uid: string }>(
    `SELECT k.data->>'uidHash' AS uid
     FROM entities dk
     JOIN entities k ON k.id = (dk.data->>'keyId')::uuid AND k.type = 'key' AND k.deleted = false
     WHERE dk.type = 'keyAccess' AND dk.deleted = false AND dk.data->>'deviceId' = $1`,
    [device.id],
  );
  const expected = computeKeysChecksum(rows.map((r) => r.uid));
  if (expected !== payload.keys_checksum) {
    console.log(`[scan-listener] keys_checksum mismatch for "${deviceUuid}" — pushing sync`);
    await pushDeviceSync(deviceUuid);
  }
}

async function handleScan(deviceUuid: string, rawPayload: Buffer): Promise<void> {
  let payload: ScanPayload;
  try {
    payload = JSON.parse(rawPayload.toString());
  } catch {
    console.error(`[scan-listener] malformed scan payload from "${deviceUuid}"`);
    return;
  }

  const { rows: [scan] } = await pool.query<{ workspaceId: UUID; deviceId: UUID; keyId: UUID | null }>(
    `SELECT d.workspace_id AS "workspaceId", d.id AS "deviceId", k.id AS "keyId"
     FROM entities d
     LEFT JOIN entities k
       ON k.workspace_id = d.workspace_id AND k.type = 'key' AND k.deleted = false
      AND k.data->>'uidHash' = $2
     WHERE d.id = $1 AND d.type = 'device' AND d.deleted = false`,
    [deviceUuid, payload.uid],
  );
  if (!scan) return;

  await recordAction({
    workspaceId: scan.workspaceId,
    deviceId: scan.deviceId,
    kind: 'scan',
    uidHash: payload.uid,
    keyId: scan.keyId,
    allowed: payload.allowed,
  });
}
