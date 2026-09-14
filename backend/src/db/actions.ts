import type { UUID, ActionKind } from '@prismo/shared/entities';
import { mutate } from './mutate';
import { insertEntity } from './entities';

// Device activity (scan/trigger/key add-remove/sync) is an entity like any
// other — one 'deviceActivity' row per event, inserted through mutate() so
// it gets a real updated_rev and rides the same sync:batch broadcast as
// device/key/keyAccess. Nothing ever updates or deletes these rows; the
// append-only nature just means every write is an insert.
export async function recordAction(params: {
  workspaceId: UUID;
  deviceId: UUID;
  kind: ActionKind;
  uidHash?: string | null;
  keyId?: UUID | null;
  allowed?: boolean | null;
  triggerAction?: string | null;
}): Promise<void> {
  await mutate(params.workspaceId, (client, seq) =>
    insertEntity(client, params.workspaceId, 'deviceActivity', {
      deviceId: params.deviceId,
      kind: params.kind,
      uidHash: params.uidHash ?? null,
      keyId: params.keyId ?? null,
      allowed: params.allowed ?? null,
      triggerAction: params.triggerAction ?? null,
      createdAt: new Date().toISOString(),
    }, seq),
  );
}
