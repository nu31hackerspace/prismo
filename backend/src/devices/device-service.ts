import crypto from 'crypto';
import type { UUID } from '@prismo/shared/entities';
import { pool } from '@/db/pg';
import { mutate } from '@/db/mutate';
import { recordAction } from '@/db/actions';
import type { TypedEntityRow } from '@/db/entities';
import {
  provisionDeviceMqttUser,
  publishToDevice,
} from './mqtt-admin';
import {
  SUBTOPICS,
  type CmdTriggerPayload,
  type CmdTriggerAction,
  type CmdSyncPayload,
} from '@/lib/mqtt-contract/mqtt-contract.generated';

export async function pushDeviceSync(deviceUuid: string): Promise<void> {
  const { rows: [device] } = await pool.query<TypedEntityRow & { workspaceId: UUID }>(
    `SELECT id, type, workspace_id AS "workspaceId", data FROM entities
     WHERE id = $1 AND type = $2 AND deleted = false`,
    [deviceUuid, 'device'],
  );
  if (!device) return;

  const { rows: keyAccesses } = await pool.query<{ keyId: UUID }>(
    `SELECT data->>'keyId' AS "keyId"
     FROM entities
     WHERE type = 'keyAccess' AND deleted = false AND data->>'deviceId' = $1`,
    [device.id],
  );
  const keyIds = keyAccesses.map((ka) => ka.keyId);

  const { rows: keys } = await pool.query<{ uid: string }>(
    `SELECT data->>'uidHash' AS uid
     FROM entities
     WHERE type = 'key' AND deleted = false AND id = ANY($1::uuid[])`,
    [keyIds],
  );

  await publishToDevice(
    deviceUuid,
    SUBTOPICS.cmd_sync,
    { keys: keys.map((k) => ({ uid: k.uid })) } satisfies CmdSyncPayload,
    { retain: true },
  );
}

export async function triggerDevice(
  deviceId: UUID,
  workspaceId: UUID,
  action: CmdTriggerAction,
): Promise<void> {
  const { rows: [device] } = await pool.query<TypedEntityRow & { workspaceId: UUID }>(
    `SELECT id, type, workspace_id AS "workspaceId", data FROM entities
     WHERE id = $1 AND type = $2 AND workspace_id = $3 AND deleted = false`,
    [deviceId, 'device', workspaceId],
  );
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
  const { rows: [device] } = await pool.query<TypedEntityRow & { workspaceId: UUID }>(
    `SELECT id, type, workspace_id AS "workspaceId", data FROM entities
     WHERE id = $1 AND type = $2 AND workspace_id = $3 AND deleted = false`,
    [deviceId, 'device', workspaceId],
  );
  if (!device) throw new Error('Device not found');
  const deviceUuid = device.id;
  await pushDeviceSync(deviceUuid);

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
  const { rows: [device] } = await pool.query<TypedEntityRow & { workspaceId: UUID }>(
    `SELECT id, type, workspace_id AS "workspaceId", data FROM entities
     WHERE id = $1 AND type = $2 AND workspace_id = $3 AND deleted = false`,
    [deviceId, 'device', workspaceId],
  );
  if (!device) throw new Error('Device not found');
  const deviceUuid = device.id;

  const mqttPassword = crypto.randomBytes(24).toString('base64url');
  await provisionDeviceMqttUser(deviceUuid, mqttPassword);

  return { mqttUser: deviceUuid, mqttPass: mqttPassword };
}
