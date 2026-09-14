import crypto from 'crypto';
import type { UUID, EntityName } from '@prismo/shared/entities';
import { pool } from '@/db/pg';
import { mutate } from '@/db/mutate';
import { recordAction } from '@/db/actions';
import { getActiveById, getActiveEntityById, insertEntity, softDelete, type TypedEntityRow } from '@/db/entities';
import { pushRetainedSync, deriveMqttPassword } from '@/devices/device-service';
import { clearRetainedForDevice, createDeviceMqttUser, deleteDeviceMqttUser } from '@/devices/mqtt-admin';
import { SUBTOPICS } from '@/lib/mqtt-contract/mqtt-contract.generated';

async function getDeviceUuidsForKey(workspaceId: UUID, keyId: UUID): Promise<string[]> {
  const { rows } = await pool.query<{ deviceUuid: string }>(
    `SELECT d.id AS "deviceUuid"
     FROM entities dk
     JOIN entities d ON d.id = (dk.data->>'deviceId')::uuid AND d.type = 'device' AND d.deleted = false
     WHERE dk.type = 'keyAccess' AND dk.workspace_id = $1 AND dk.data->>'keyId' = $2 AND dk.deleted = false`,
    [workspaceId, keyId],
  );
  return rows.map((r) => r.deviceUuid);
}

interface KeyAccessContext {
  deviceId: UUID;
  deviceUuid: string;
  keyId: UUID;
  uidHash: string;
}

// Resolves the device/key pair a keyAccess row links, so the device can be
// told (over MQTT) which key to forget once the row itself is gone.
async function getKeyAccessContext(workspaceId: UUID, entity: TypedEntityRow): Promise<KeyAccessContext | null> {
  const deviceId = entity.data.deviceId as UUID;
  const keyId = entity.data.keyId as UUID;
  const [device, key] = await Promise.all([
    getActiveById(pool, workspaceId, 'device', deviceId),
    getActiveById(pool, workspaceId, 'key', keyId),
  ]);
  if (!device || !key) return null;
  return { deviceId, deviceUuid: device.id, keyId, uidHash: key.data.uidHash as string };
}

export async function deleteEntity(workspaceId: UUID, id: UUID): Promise<{ id: UUID; type: EntityName }> {
  const entity = await getActiveEntityById(pool, workspaceId, id);
  if (!entity) {
    throw new Error('Entity not found');
  }

  const linkedDeviceUuids = entity.type === 'key' ? await getDeviceUuidsForKey(workspaceId, id) : [];
  const keyAccessContext = entity.type === 'keyAccess' ? await getKeyAccessContext(workspaceId, entity) : null;

  if (entity.type === 'device') {
    const deviceUuid = entity.id;
    await clearRetainedForDevice(deviceUuid, [SUBTOPICS.cmd_sync]).catch(() => { });
    await deleteDeviceMqttUser(deviceUuid).catch(() => { });
  }

  await mutate(workspaceId, async (client, seq) => {
    const deletedId = await softDelete(client, seq, workspaceId, id);
    if (!deletedId) throw new Error('Entity not found');
  });

  for (const uuid of linkedDeviceUuids) {
    pushRetainedSync(uuid).catch((err) =>
      console.error(`[entity-service] retained sync failed after deleteEntity(key) for "${uuid}":`, err),
    );
  }

  if (keyAccessContext) {
    const { deviceId, deviceUuid, keyId, uidHash } = keyAccessContext;

    recordAction({
      workspaceId,
      deviceId,
      kind: 'key_removed',
      uidHash,
      keyId,
    }).catch((err) => console.error('[entity-service] recordAction(key_removed) failed:', err));

    pushRetainedSync(deviceUuid).catch((err) =>
      console.error(`[entity-service] retained sync failed after deleteEntity(keyAccess) for "${deviceUuid}":`, err),
    );
  }

  return { id, type: entity.type };
}

async function createKeyAccess(workspaceId: UUID, data: Record<string, unknown>): Promise<UUID> {
  const deviceId = data.deviceId as UUID | undefined;
  const keyId = data.keyId as UUID | undefined;
  if (!deviceId || !keyId) throw new Error('Missing deviceId or keyId');

  const device = await getActiveById(pool, workspaceId, 'device', deviceId);
  if (!device) throw new Error('Device not found');
  const key = await getActiveById(pool, workspaceId, 'key', keyId);
  if (!key) throw new Error('Key not found');
  const deviceUuid = device.id;
  const uidHash = key.data.uidHash as string;

  await mutate(workspaceId, async (client, seq) => {
    // The unique (deviceId, keyId) pair may already exist as a tombstoned
    // row from a prior delete — undelete it instead of inserting a
    // duplicate. The conflict WHERE guard keeps re-creating an already
    // active link a no-op (no row affected, no spurious rev bump).
    await client.query(
      `INSERT INTO entities (workspace_id, type, data, updated_rev)
       VALUES ($1, 'keyAccess', $2::jsonb, $3)
       ON CONFLICT ((data->>'deviceId'), (data->>'keyId')) WHERE type = 'keyAccess'
       DO UPDATE SET deleted = false, updated_rev = EXCLUDED.updated_rev, updated_at = now()
       WHERE entities.deleted = true`,
      [workspaceId, JSON.stringify({ deviceId: device.id, keyId: key.id }), seq],
    );
  });

  const { rows: [row] } = await pool.query<{ id: UUID }>(
    `SELECT id FROM entities
     WHERE workspace_id = $1 AND type = 'keyAccess'
       AND data->>'deviceId' = $2 AND data->>'keyId' = $3 AND deleted = false`,
    [workspaceId, device.id, key.id],
  );

  recordAction({
    workspaceId,
    deviceId: device.id,
    kind: 'key_added',
    uidHash,
    keyId: key.id,
  }).catch((err) => console.error('[entity-service] recordAction(key_added) failed:', err));

  pushRetainedSync(deviceUuid).catch((err) =>
    console.error(`[entity-service] retained sync failed after createEntity(keyAccess) for "${deviceUuid}":`, err),
  );

  return row.id;
}

async function createKey(workspaceId: UUID, data: Record<string, unknown>): Promise<UUID> {
  const uidHash = data.uidHash as string | undefined;
  const label = data.label as string | undefined;
  if (!uidHash || !label) throw new Error('Missing uidHash or label');

  const row = await mutate(workspaceId, async (client, seq) => {
    // uidHash is unique per workspace — a row with it may already exist as a
    // tombstoned key from a prior delete, or already active if the same tag
    // was named before. Either way, undelete/relabel it instead of a plain
    // insert.
    const { rows: [row] } = await client.query<{ id: UUID }>(
      `INSERT INTO entities (workspace_id, type, data, updated_rev)
       VALUES ($1, 'key', $2::jsonb, $3)
       ON CONFLICT (workspace_id, (data->>'uidHash')) WHERE type = 'key'
       DO UPDATE SET
         data = entities.data || jsonb_build_object('label', EXCLUDED.data->>'label'),
         deleted = false,
         updated_rev = EXCLUDED.updated_rev,
         updated_at = now()
       RETURNING id`,
      [workspaceId, JSON.stringify({ label, uidHash, createdAt: new Date().toISOString() }), seq],
    );
    return row;
  });

  return row.id;
}

async function createDevice(workspaceId: UUID, data: Record<string, unknown>): Promise<UUID> {
  const name = data.name as string | undefined;
  if (!name) throw new Error('Missing name');
  const mode = (data.mode as string | undefined) ?? 'door';
  const id = crypto.randomUUID();

  // Provision the broker identity before the row exists so nothing can ever
  // observe a device entity whose DynSec client wasn't created. The id is
  // generated here rather than left to the DB default so it can double as
  // the device's MQTT username/topic segment.
  const tokenKey = crypto.randomBytes(4).toString('hex');
  const mqttPassword = deriveMqttPassword(tokenKey);
  await createDeviceMqttUser(id, mqttPassword);

  const row = await mutate(workspaceId, (client, seq) =>
    insertEntity(client, workspaceId, 'device', {
      name,
      mode,
      modeParams: {},
      lastSeenAt: null,
    }, seq, id),
  );

  await pool.query(
    'INSERT INTO device_secrets (device_id, token_key) VALUES ($1, $2)',
    [row.id, tokenKey],
  );

  return row.id;
}

// Creates any entity of a user-creatable type, provided any entities it
// references (e.g. keyAccess's deviceId/keyId) belong to `workspaceId` — the
// same permission model as deleteEntity. Dispatched by type since each one's
// validation and side effects differ.
export async function createEntity(
  workspaceId: UUID,
  type: EntityName,
  data: Record<string, unknown>,
): Promise<{ id: UUID; type: EntityName }> {
  const id = type === 'device'
    ? await createDevice(workspaceId, data)
    : type === 'key'
      ? await createKey(workspaceId, data)
      : await createKeyAccess(workspaceId, data);

  return { id, type };
}
