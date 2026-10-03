import type { UUID } from '@prismo/shared/entities';
import { query } from './db/pg';

export async function getWorkspaceForUser(userId: UUID): Promise<UUID | null> {
  const { rows } = await query(
    'SELECT workspaces FROM "user" WHERE id = $1 LIMIT 1',
    [userId]
  );
  return rows[0]?.workspaces?.[0] ?? null;
}

export async function resolveWorkspace(userId: UUID, requested: unknown): Promise<UUID | null> {
  if (typeof requested !== 'string' || !requested) return null;
  const { rows } = await query(
    'SELECT 1 FROM "user" WHERE id = $1 AND workspaces ? $2',
    [userId, requested]
  );
  return rows.length ? requested : null;
}

export async function ensureUserAndMembership(googleId: string, email: string, name: string): Promise<string> {
  const { rows: userRows } = await query(
    `INSERT INTO "user" (email, name, meta) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, meta = EXCLUDED.meta
     RETURNING id`,
    [email, name, JSON.stringify({ google_id: googleId })]
  );
  const userId = userRows[0].id;

  // Ensure workspace + membership exist
  const existingWs = await getWorkspaceForUser(userId);
  if (!existingWs) {
    // Create a default workspace for this user
    const { rows: wsRows } = await query(
      `INSERT INTO workspace (name) VALUES ($1) RETURNING id`,
      [`${name}'s workspace`]
    );
    const workspaceId = wsRows[0].id;
    await query(
      `UPDATE "user" SET workspaces = workspaces || $1::jsonb WHERE id = $2`,
      [JSON.stringify([workspaceId]), userId]
    );
  }

  return userId;
}
