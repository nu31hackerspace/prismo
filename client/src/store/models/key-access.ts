import type { UUID } from '@prismo/shared/entities';
import { Entity, ModelBase } from './base';

// The device<->key join row itself. Not surfaced directly to the UI — it's
// what Device.keys / Key.devices (@ManyToMany) resolve through.
@Entity('keyAccess')
export class KeyAccess extends ModelBase {
  declare readonly id: UUID;
  declare readonly workspaceId: UUID;
  declare readonly deviceId: UUID;
  declare readonly keyId: UUID;
}
