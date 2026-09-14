import type pg from 'pg';
import type { UUID, EntityName } from '@prismo/shared/entities';
import type { Change, ChangeBatch } from '@prismo/shared/sync';
import { transaction } from './pg';
import { toWire } from './entities';

let broadcast: ((workspaceId: UUID, batch: ChangeBatch) => void) | undefined;

export function setBroadcast(fn: (workspaceId: UUID, batch: ChangeBatch) => void) {
  broadcast = fn;
}

export async function mutate<T>(
  workspaceId: UUID,
  fn: (client: pg.PoolClient, seq: number) => Promise<T>,
): Promise<T> {
  const { result, changes, seq } = await transaction(async (client) => {
    // Bump (and lock) the workspace row first: every entity write in this
    // transaction is tagged with the resulting seq, so a delta query for
    // `updated_rev > N` can never observe a row without also observing the
    // rev that made it visible.
    const { rows } = await client.query<{ seq: string }>(
      'UPDATE workspace SET seq = seq + 1 WHERE id = $1 RETURNING seq',
      [workspaceId],
    );
    const seq = Number(rows[0].seq);
    const result = await fn(client, seq);

    // Broadcast is derived from the DB itself, not from anything `fn`
    // reports: every row `fn` touched carries this exact seq (set by the
    // helpers in entities.ts, or by `fn`'s own writes), so reading them back
    // here is the actual set of changes — a write can never fail to be
    // broadcast because a caller forgot to mention it.
    const { rows: touched } = await client.query<{ id: UUID; type: EntityName; data: Record<string, unknown>; deleted: boolean }>(
      `SELECT id, type, data, deleted FROM entities WHERE workspace_id = $1 AND updated_rev = $2`,
      [workspaceId, seq],
    );
    const changes: Change[] = touched.map((row): Change =>
      row.deleted
        ? { op: 'delete', entity: row.type, id: row.id }
        : { op: 'upsert', entity: row.type, data: toWire(workspaceId, row) as never },
    );

    return { result, changes, seq };
  });

  if (broadcast && changes.length > 0) {
    broadcast(workspaceId, { seq, changes });
  }

  return result;
}
