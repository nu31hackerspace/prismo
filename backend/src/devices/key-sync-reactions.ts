import type { UUID } from '@prismo/shared/entities';
import { pool } from '@/db/pg';
import { onEntityChange } from '@/db/hooks';
import { pushDeviceSync } from './device-service';
import { deleteDeviceMqttUser } from './mqtt-admin';

export function registerKeySyncReactions(): void {
  onEntityChange((change) => {
    if (change.op === 'upsert' && change.entity === 'keyAccess') {
      syncDeviceAfterKeyUpdates(change.workspaceId, change.id).catch((err) =>
        console.error(`[key-sync-reactions] sync after keyAccess upsert failed for "${change.data.id}":`, err),
      );
    }

    if (change.op === 'delete' && change.entity === 'keyAccess') {
      syncDeviceAfterKeyUpdates(change.workspaceId, change.id).catch((err) =>
        console.error(`[key-sync-reactions] sync after keyAccess delete failed for "${change.id}":`, err),
      );
    }

    if (change.op === 'delete' && change.entity === 'device') {
      deleteDeviceMqttUser(change.id).catch(() => { });
    }
  });
}

async function syncDeviceAfterKeyUpdates(workspaceId: UUID, keyAccessUUID: UUID): Promise<void> {
  const { rows: [keyAccessRow] } = await pool.query<{ deviceId: UUID; keyId: UUID }>(
    `SELECT data->>'deviceId' AS "deviceId", data->>'keyId' AS "keyId"
     FROM entities WHERE id = $1 AND workspace_id = $2 AND type = 'keyAccess'`,
    [keyAccessUUID, workspaceId],
  );
  if (!keyAccessRow) return;

  const deviceId = keyAccessRow.deviceId
  await pushDeviceSync(deviceId);
}
