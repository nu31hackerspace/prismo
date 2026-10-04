import type { UUID, HookKind } from '@prismo/shared/entities';
import { Entity, ModelBase } from './base';

@Entity('hook')
export class Hook extends ModelBase {
  declare readonly id: UUID;
  declare readonly workspaceId: UUID;
  declare readonly deviceId: UUID;
  declare readonly kind: HookKind;
  declare readonly url: string;
}
