import type pg from 'pg';
import type { UUID, EntityName } from '@prismo/shared/entities';
import type { Change, ChangeBatch } from '@prismo/shared/sync';
import { transaction } from './pg';
import { toUpsertChange } from './entities';
import { dispatchEntityChanges } from './hooks';

let broadcast: ((workspaceId: UUID, batch: ChangeBatch) => void) | undefined;

export function setBroadcast(fn: (workspaceId: UUID, batch: ChangeBatch) => void) {
  broadcast = fn;
}

export async function mutate<T>(
  workspaceId: UUID,
  fn: (client: pg.PoolClient, seq: number) => Promise<T>,
): Promise<T> {
  const { result, changes, seq } = await transaction(async (client) => {
    const { rows } = await client.query<{ seq: string }>(
      'UPDATE workspace SET seq = seq + 1 WHERE id = $1 RETURNING seq',
      [workspaceId],
    );
    const seq = Number(rows[0].seq);
    const result = await fn(client, seq);

    const { rows: touched } = await client.query<{ id: UUID; type: EntityName; data: Record<string, unknown>; deleted: boolean }>(
      `SELECT id, type, data, deleted FROM entities WHERE workspace_id = $1 AND updated_rev = $2`,
      [workspaceId, seq],
    );
    const changes: Change[] = touched.map((row): Change =>
      row.deleted
        ? { op: 'delete', entity: row.type, id: row.id }
        : toUpsertChange(workspaceId, row),
    );

    return { result, changes, seq };
  });

  if (changes.length > 0) {
    if (broadcast) broadcast(workspaceId, { seq, changes });
    dispatchEntityChanges(workspaceId, changes);
  }

  return result;
}
