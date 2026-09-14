import type { UUID, User, EntityName } from '@prismo/shared/entities';
import type { SnapshotMessage, ChangeBatch, Change, WireEntity } from '@prismo/shared/sync';
import { transaction } from './pg';
import { toWire } from './entities';

export async function readSnapshot(workspaceId: UUID): Promise<SnapshotMessage> {
  return transaction(async (client) => {
    const { rows: [ws] } = await client.query<{ id: UUID; name: string; seq: string }>(
      'SELECT id, name, seq FROM workspace WHERE id = $1', [workspaceId]
    );
    const seq = Number(ws.seq);

    const { rows: users } = await client.query<User>(
      `SELECT id, email, name, workspaces
       FROM "user"
       WHERE workspaces @> $1::jsonb`,
      [JSON.stringify([workspaceId])]
    );

    const { rows } = await client.query<{ id: UUID; type: EntityName; data: Record<string, unknown> }>(
      `SELECT id, type, data FROM entities
       WHERE workspace_id = $1 AND deleted = false`,
      [workspaceId]
    );

    // `workspace` itself, like `user`, isn't a row in the generic `entities`
    // table, so it rides the snapshot only — full-resent on reconnect, not
    // covered by readDelta below. Fine as long as it stays effectively
    // immutable (rename support would need it added to readDelta too).
    const entities: WireEntity[] = [
      { entity: 'workspace', data: { id: ws.id, name: ws.name } },
      ...users.map((data): WireEntity => ({ entity: 'user', data })),
    ];
    for (const row of rows) entities.push({ entity: row.type, data: toWire(workspaceId, row) } as WireEntity);

    return { seq, entities };
  });
}

// Everything that changed in a workspace since `sinceSeq`, tombstones
// included. Only covers workspace-scoped, single-owner entities (device /
// key / keyAccess / deviceActivity) — `user` rows can belong to several
// workspaces at once, so there's no single per-row rev that means "changed
// for workspace X"; user membership stays fully resent on the rare
// occasions it changes and otherwise doesn't need a live subscription.
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
        : { op: 'upsert', entity: row.type, data: toWire(workspaceId, row) as never }
    );

    return { seq, changes };
  });
}
