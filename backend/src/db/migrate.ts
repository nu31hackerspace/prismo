import { query } from './pg';

export async function migrate() {
  await query('CREATE EXTENSION IF NOT EXISTS citext');

  await query(`
    CREATE TABLE IF NOT EXISTS workspace (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      seq bigint NOT NULL DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email citext NOT NULL UNIQUE,
      name text NOT NULL,
      meta jsonb NOT NULL DEFAULT '{}',
      workspaces jsonb NOT NULL DEFAULT '[]'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS entities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspace ON DELETE CASCADE,
      type text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}',
      updated_rev bigint NOT NULL DEFAULT 0,
      deleted boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_entities_rev ON entities (workspace_id, updated_rev)');
  await query('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (workspace_id, type)');

  await query('DROP INDEX IF EXISTS idx_entities_device_slug');
  await query('DROP INDEX IF EXISTS idx_entities_device_uuid');
  await query('DROP INDEX IF EXISTS idx_entities_key_uid');
  await query('DROP INDEX IF EXISTS idx_entities_key_access_pair');

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_key_uid_active
      ON entities (workspace_id, (data->>'uidHash'))
      WHERE type = 'key' AND deleted = false
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_key_access_pair_active
      ON entities (workspace_id, (data->>'deviceId'), (data->>'keyId'))
      WHERE type = 'keyAccess' AND deleted = false
  `);

  await query('DROP TABLE IF EXISTS device_secrets');

  await query(`
    CREATE TABLE IF NOT EXISTS analytics_event (
      uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_uuid uuid REFERENCES "user" ON DELETE SET NULL,
      device_session uuid NOT NULL,
      action text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_analytics_event_device_session ON analytics_event (device_session)');
  await query('CREATE INDEX IF NOT EXISTS idx_analytics_event_user_uuid ON analytics_event (user_uuid)');
  await query('CREATE INDEX IF NOT EXISTS idx_analytics_event_action ON analytics_event (action)');
}

