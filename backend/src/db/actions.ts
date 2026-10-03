import type { UUID, ActionKind } from '@prismo/shared/entities';
import { mutate } from './mutate';
import { insertEntity } from './entities';

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
