import type pg from 'pg';
import type { UUID, EntityName } from '@prismo/shared/entities';

// Every helper here works with either the shared pool (for a one-off read)
// or a transaction's PoolClient (for reads/writes inside mutate()).
type Queryable = pg.Pool | pg.PoolClient;

export interface EntityRow {
  id: UUID;
  data: Record<string, unknown>;
}

export interface TypedEntityRow extends EntityRow {
  type: EntityName;
}

// Reconstructs the wire shape (id + workspaceId alongside the JSONB payload)
// that EntityMap types expect — those two live as real columns, not inside
// `data`, so every entity gets them synthesized back on the way out.
export function toWire(workspaceId: UUID, row: EntityRow): Record<string, unknown> {
  return { id: row.id, workspaceId, ...row.data };
}

export async function insertEntity(
  db: Queryable,
  workspaceId: UUID,
  type: EntityName,
  data: Record<string, unknown>,
  seq: number,
): Promise<EntityRow> {
  const { rows: [row] } = await db.query<EntityRow>(
    `INSERT INTO entities (workspace_id, type, data, updated_rev)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, data`,
    [workspaceId, type, JSON.stringify(data), seq],
  );
  return row;
}

export async function findActive(
  db: Queryable,
  workspaceId: UUID,
  type: EntityName,
  field: string,
  value: string,
): Promise<EntityRow | null> {
  const { rows: [row] } = await db.query<EntityRow>(
    `SELECT id, data FROM entities
     WHERE workspace_id = $1 AND type = $2 AND data ->> $3 = $4 AND deleted = false`,
    [workspaceId, type, field, value],
  );
  return row ?? null;
}

// Same as findActive but not scoped to a workspace — used where the caller
// only has a value that's globally unique (e.g. a device slug from an MQTT
// topic, before the workspace is known).
export async function findActiveGlobal(
  db: Queryable,
  type: EntityName,
  field: string,
  value: string,
): Promise<(EntityRow & { workspaceId: UUID }) | null> {
  const { rows: [row] } = await db.query<EntityRow & { workspaceId: UUID }>(
    `SELECT id, workspace_id AS "workspaceId", data FROM entities
     WHERE type = $1 AND data ->> $2 = $3 AND deleted = false`,
    [type, field, value],
  );
  return row ?? null;
}

export async function getActiveById(
  db: Queryable,
  workspaceId: UUID,
  type: EntityName,
  id: UUID,
): Promise<EntityRow | null> {
  const { rows: [row] } = await db.query<EntityRow>(
    `SELECT id, data FROM entities
     WHERE id = $1 AND workspace_id = $2 AND type = $3 AND deleted = false`,
    [id, workspaceId, type],
  );
  return row ?? null;
}

// Same as getActiveById, but for callers that only have an id and need to
// discover what it is (and whether it belongs to this workspace at all)
// before deciding how to handle it — the generic entity-delete flow's
// permission check.
export async function getActiveEntityById(
  db: Queryable,
  workspaceId: UUID,
  id: UUID,
): Promise<TypedEntityRow | null> {
  const { rows: [row] } = await db.query<TypedEntityRow>(
    `SELECT id, type, data FROM entities
     WHERE id = $1 AND workspace_id = $2 AND deleted = false`,
    [id, workspaceId],
  );
  return row ?? null;
}

// Scoped to workspaceId so a caller can never soft-delete a row it merely
// guessed the id of — the row must actually belong to this workspace.
export async function softDelete(
  db: Queryable,
  seq: number,
  workspaceId: UUID,
  id: UUID,
): Promise<UUID | null> {
  const { rows: [row] } = await db.query<{ id: UUID }>(
    `UPDATE entities SET deleted = true, updated_rev = $1, updated_at = now()
     WHERE id = $2 AND workspace_id = $3 AND deleted = false RETURNING id`,
    [seq, id, workspaceId],
  );
  return row?.id ?? null;
}

// Soft-deletes every row of `type` in the workspace whose data matches every
// field/value pair in `match` (both field names and values are bound as
// query parameters, never interpolated).
export async function softDeleteWhere(
  db: Queryable,
  seq: number,
  workspaceId: UUID,
  type: EntityName,
  match: Record<string, string>,
): Promise<UUID[]> {
  const params: unknown[] = [seq, workspaceId, type];
  const conditions = Object.entries(match).map(([field, value]) => {
    const fieldIdx = params.length + 1;
    const valueIdx = params.length + 2;
    params.push(field, value);
    return `data ->> $${fieldIdx} = $${valueIdx}`;
  });

  const { rows } = await db.query<{ id: UUID }>(
    `UPDATE entities SET deleted = true, updated_rev = $1, updated_at = now()
     WHERE workspace_id = $2 AND type = $3 AND deleted = false AND ${conditions.join(' AND ')}
     RETURNING id`,
    params,
  );
  return rows.map((r) => r.id);
}
