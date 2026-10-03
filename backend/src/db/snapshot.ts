import type { UUID, EntityName } from '@prismo/shared/entities';
import type { SnapshotMessage, ChangeBatch, Change, WireEntity } from '@prismo/shared/sync';
import { transaction } from './pg';
import { toWireEntity, toUpsertChange } from './entities';

export async function readSnapshot(workspaceId: UUID): Promise<SnapshotMessage> {
  return transaction(async (client) => {
    const { rows: [ws] } = await client.query<{ id: UUID; name: string; seq: string }>(
      'SELECT id, name, seq FROM workspace WHERE id = $1', [workspaceId]
    );
    const seq = Number(ws.seq);

    const { rows } = await client.query<{ id: UUID; type: EntityName; data: Record<string, unknown> }>(
      `SELECT id, type, data FROM entities
       WHERE workspace_id = $1 AND deleted = false`,
      [workspaceId]
    );

    const entities: WireEntity[] = [
      { entity: 'workspace', data: { id: ws.id, name: ws.name } },
    ];
    for (const row of rows) entities.push(toWireEntity(workspaceId, row));

    return { seq, entities };
  });
}

export async function readDelta(workspaceId: UUID, sinceSeq: number): Promise<ChangeBatch> {
  return transaction(async (client) => {
    const { rows: [ws] } = await client.query<{ seq: string }>(
      'SELECT seq FROM workspace WHERE id = $1', [workspaceId]
    );
    const seq = Number(ws.seq);

    const { rows } = await client.query<{ id: UUID; type: EntityName; data: Record<string, unknown>; deleted: boolean }>(
      `SELECT id, type, data, deleted FROM entities
       WHERE workspace_id = $1 AND updated_rev > $2
       ORDER BY updated_rev`,
      [workspaceId, sinceSeq]
    );

    const changes: Change[] = rows.map((row): Change =>
      row.deleted
        ? { op: 'delete', entity: row.type, id: row.id }
        : toUpsertChange(workspaceId, row)
    );

    return { seq, changes };
  });
}
