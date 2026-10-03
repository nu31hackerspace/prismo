import type { ActionKind, UUID } from '@prismo/shared/entities';
import { Entity, ModelBase } from './base';
import { ManyToOne } from './relations';
import type { Key } from './key';
import type { Device } from './device';

@Entity('deviceActivity')
export class DeviceActivity extends ModelBase {
  declare readonly id: UUID;
  declare readonly workspaceId: UUID;
  declare readonly deviceId: UUID;
  declare readonly kind: ActionKind;
  declare readonly uidHash: string | null;
  declare readonly keyId: UUID | null;
  declare readonly allowed: boolean | null;
  declare readonly triggerAction: string | null;
  declare readonly createdAt: string;

  @ManyToOne('device', 'deviceId') accessor device!: Device | undefined;
  @ManyToOne('key', 'keyId') accessor key!: Key | undefined;

  get username(): string | null {
    return this.key?.label ?? null;
  }
}
