import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { UUID } from '@prismo/shared/entities';
import { pool } from '@/db/pg';
import { mutate } from '@/db/mutate';
import { recordAction } from '@/db/actions';
import {
  getActiveByIdGlobal,
  getActiveById,
} from '@/db/entities';
import {
  updateDeviceMqttPassword,
  publishToDevice,
} from './mqtt-admin';
import {
  SUBTOPICS,
  type CmdTriggerPayload,
  type CmdTriggerAction,
  type CmdSyncPayload,
} from '@/lib/mqtt-contract/mqtt-contract.generated';

export function deriveMqttPassword(tokenKey: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var is not set');
  return jwt.sign({ tokenKey }, secret, { noTimestamp: true });
}

export async function pushRetainedSync(deviceUuid: string): Promise<void> {
  const device = await getActiveByIdGlobal(pool, 'device', deviceUuid);
  if (!device) return;

  const { rows: keys } = await pool.query<{ uid: string; username: string }>(
    `SELECT k.data->>'uidHash' AS uid, k.data->>'label' AS username
     FROM entities dk
     JOIN entities k ON k.id = (dk.data->>'keyId')::uuid AND k.type = 'key' AND k.deleted = false
     WHERE dk.type = 'keyAccess' AND dk.deleted = false AND dk.data->>'deviceId' = $1`,
    [device.id],
  );

  await publishToDevice(
    deviceUuid,
    SUBTOPICS.cmd_sync,
    { keys: keys.map((k) => ({ uid: k.uid, username: k.username })) } satisfies CmdSyncPayload,
    { retain: true },
  );
}

export async function triggerDevice(
  deviceId: UUID,
  workspaceId: UUID,
  action: CmdTriggerAction,
): Promise<void> {
  const device = await getActiveById(pool, workspaceId, 'device', deviceId);
  if (!device) throw new Error('Device not found');
  const deviceUuid = device.id;

  if (action === 'on' || action === 'off') {
    await mutate(workspaceId, async (client, seq) => {
      await client.query(
        `UPDATE entities SET data = jsonb_set(data, '{modeParams,isOn}', $1::jsonb),
                updated_rev = $2, updated_at = now()
         WHERE id = $3`,
        [JSON.stringify(action === 'on'), seq, device.id],
      );
    });
  }

  await publishToDevice(
    deviceUuid,
    SUBTOPICS.cmd_trigger,
    { action } satisfies CmdTriggerPayload,
  );

  recordAction({
    workspaceId,
    deviceId: device.id,
    kind: 'trigger',
    triggerAction: action,
  }).catch((err) => console.error('[device-service] recordAction(trigger) failed:', err));
}

export async function forceSyncDevice(
  deviceId: UUID,
  workspaceId: UUID,
): Promise<void> {
  const device = await getActiveById(pool, workspaceId, 'device', deviceId);
  if (!device) throw new Error('Device not found');
  const deviceUuid = device.id;
  await pushRetainedSync(deviceUuid);

  recordAction({
    workspaceId,
    deviceId: device.id,
    kind: 'sync',
  }).catch((err) => console.error('[device-service] recordAction(sync) failed:', err));
}

export async function generateMqttCredentials(
  deviceId: UUID,
  workspaceId: UUID,
) {
  const device = await getActiveById(pool, workspaceId, 'device', deviceId);
  if (!device) throw new Error('Device not found');
  const deviceUuid = device.id;

  const tokenKey = crypto.randomBytes(4).toString('hex');
  const mqttPassword = deriveMqttPassword(tokenKey);

  await updateDeviceMqttPassword(deviceUuid, mqttPassword);
  await pool.query('UPDATE device_secrets SET token_key = $1 WHERE device_id = $2', [
    tokenKey,
    device.id,
  ]);

  return { mqttUser: deviceUuid, mqttPass: mqttPassword };
}
