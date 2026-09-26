import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { UUID, EntityName, EntityMap } from '@prismo/shared/entities';
import type { WireEntity, Change } from '@prismo/shared/sync';

type Queryable = pg.Pool | pg.PoolClient;

export interface EntityRow {
  id: UUID;
  data: Record<string, unknown>;
}

export interface TypedEntityRow extends EntityRow {
  type: EntityName;
}

function toWire<K extends EntityName>(workspaceId: UUID, row: EntityRow): EntityMap[K] {
  return { id: row.id, workspaceId, ...row.data } as unknown as EntityMap[K];
}

export function toWireEntity(workspaceId: UUID, row: TypedEntityRow): WireEntity {
  return { entity: row.type, data: toWire(workspaceId, row) } as WireEntity;
}

export function toUpsertChange(workspaceId: UUID, row: TypedEntityRow): Change {
  return { op: 'upsert', entity: row.type, id: row.id, data: toWire(workspaceId, row) } as Change;
}

export async function insertEntity(
  db: Queryable,
  workspaceId: UUID,
  type: EntityName,
  data: Record<string, unknown>,
  seq: number,
  id: UUID = randomUUID(),
): Promise<EntityRow | null> {
  const { rows: [row] } = await db.query<EntityRow>(
    `INSERT INTO entities (id, workspace_id, type, data, updated_rev)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (id) DO UPDATE
       SET data = EXCLUDED.data, updated_rev = EXCLUDED.updated_rev, updated_at = now()
       WHERE entities.workspace_id = EXCLUDED.workspace_id
         AND entities.type = EXCLUDED.type
         AND entities.deleted = false
     RETURNING id, data`,
    [id, workspaceId, type, JSON.stringify(data), seq],
  );
  return row ?? null;
}

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
