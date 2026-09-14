import crypto from 'crypto';
import type pg from 'pg';
import type { UUID, EntityName } from '@prismo/shared/entities';
import { pool } from '@/db/pg';
import { mutate } from '@/db/mutate';
import { recordAction } from '@/db/actions';
import { getActiveById, getActiveEntityById, insertEntity, softDelete, softDeleteWhere, type TypedEntityRow } from '@/db/entities';
import { pushRetainedSync } from '@/devices/device-service';
import { clearRetainedForDevice, deleteDeviceMqttUser, publishToDevice } from '@/devices/mqtt-admin';
import { SUBTOPICS, type CmdAddKeyPayload, type CmdRemoveKeyPayload } from '@/lib/mqtt-contract/mqtt-contract.generated';

const DELETABLE_TYPES = new Set<EntityName>(['device', 'key', 'keyAccess']);

const CREATABLE_TYPES = new Set<EntityName>(['device', 'key', 'keyAccess']);

async function getDeviceSlugsForKey(workspaceId: UUID, keyId: UUID): Promise<string[]> {
  const { rows } = await pool.query<{ deviceSlug: string }>(
    `SELECT d.data->>'deviceSlug' AS "deviceSlug"
     FROM entities dk
     JOIN entities d ON d.id = (dk.data->>'deviceId')::uuid AND d.type = 'device' AND d.deleted = false
     WHERE dk.type = 'keyAccess' AND dk.workspace_id = $1 AND dk.data->>'keyId' = $2 AND dk.deleted = false`,
    [workspaceId, keyId],
  );
  return rows.map((r) => r.deviceSlug);
}

async function cascadeDelete(
  client: pg.PoolClient,
  seq: number,
  workspaceId: UUID,
  entity: TypedEntityRow,
): Promise<void> {
  if (entity.type === 'device') {
    await softDeleteWhere(client, seq, workspaceId, 'keyAccess', { deviceId: entity.id });
  }
  if (entity.type === 'key') {
    await softDeleteWhere(client, seq, workspaceId, 'keyAccess', { keyId: entity.id });
  }
}

interface KeyAccessContext {
  deviceId: UUID;
  deviceSlug: string;
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
  return { deviceId, deviceSlug: device.data.deviceSlug as string, keyId, uidHash: key.data.uidHash as string };
}

// Deletes any entity by id, provided it belongs to `workspaceId` — the only
// permission check this needs, since workspace membership is already
// established by requireAuth. Cascades and side effects are dispatched by
// entity type.
export async function deleteEntity(workspaceId: UUID, id: UUID): Promise<{ id: UUID; type: EntityName }> {
  const entity = await getActiveEntityById(pool, workspaceId, id);
  if (!entity || !DELETABLE_TYPES.has(entity.type)) {
    throw new Error('Entity not found');
  }

  // Collected before the delete removes the keyAccess links that make these
  // queries possible.
  const linkedDeviceSlugs = entity.type === 'key' ? await getDeviceSlugsForKey(workspaceId, id) : [];
  const keyAccessContext = entity.type === 'keyAccess' ? await getKeyAccessContext(workspaceId, entity) : null;

  if (entity.type === 'device') {
    const deviceSlug = entity.data.deviceSlug as string;
    await clearRetainedForDevice(deviceSlug, [SUBTOPICS.cmd_sync]).catch(() => { });
    await deleteDeviceMqttUser(deviceSlug).catch(() => { });
  }

  await mutate(workspaceId, async (client, seq) => {
    await cascadeDelete(client, seq, workspaceId, entity);
    const deletedId = await softDelete(client, seq, workspaceId, id);
    if (!deletedId) throw new Error('Entity not found');
  });

  for (const slug of linkedDeviceSlugs) {
    pushRetainedSync(slug).catch((err) =>
      console.error(`[entity-service] retained sync failed after deleteEntity(key) for "${slug}":`, err),
    );
  }

  if (keyAccessContext) {
    const { deviceId, deviceSlug, keyId, uidHash } = keyAccessContext;

    recordAction({
      workspaceId,
      deviceId,
      kind: 'key_removed',
      uidHash,
      keyId,
    }).catch((err) => console.error('[entity-service] recordAction(key_removed) failed:', err));

    publishToDevice(deviceSlug, SUBTOPICS.cmd_remove_key, {
      uid: uidHash,
    } satisfies CmdRemoveKeyPayload).catch((err) =>
      console.error(`[entity-service] cmd/remove_key failed for "${deviceSlug}":`, err),
    );
    pushRetainedSync(deviceSlug).catch((err) =>
      console.error(`[entity-service] retained sync failed after deleteEntity(keyAccess) for "${deviceSlug}":`, err),
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
  const deviceSlug = device.data.deviceSlug as string;
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

  publishToDevice(deviceSlug, SUBTOPICS.cmd_add_key, {
    uid: uidHash,
  } satisfies CmdAddKeyPayload).catch((err) =>
    console.error(`[entity-service] cmd/add_key failed for "${deviceSlug}":`, err),
  );
  pushRetainedSync(deviceSlug).catch((err) =>
    console.error(`[entity-service] retained sync failed after createEntity(keyAccess) for "${deviceSlug}":`, err),
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

function generateDeviceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

async function createDevice(workspaceId: UUID, data: Record<string, unknown>): Promise<UUID> {
  const name = data.name as string | undefined;
  if (!name) throw new Error('Missing name');
  const mode = (data.mode as string | undefined) ?? 'door';
  const deviceSlug = generateDeviceSlug(name);

  const row = await mutate(workspaceId, (client, seq) =>
    insertEntity(client, workspaceId, 'device', {
      name,
      deviceSlug,
      mode,
      modeParams: {},
      lastSeenAt: null,
    }, seq),
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
  if (!CREATABLE_TYPES.has(type)) throw new Error(`Cannot create entity of type "${type}"`);

  const id = type === 'device'
    ? await createDevice(workspaceId, data)
    : type === 'key'
      ? await createKey(workspaceId, data)
      : await createKeyAccess(workspaceId, data);

  return { id, type };
}
