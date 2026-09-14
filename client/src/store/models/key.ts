import type { UUID } from '@prismo/shared/entities';
import { Entity, ModelBase } from './base';
import { ManyToOne, ManyToMany } from './relations';
import type { Workspace } from './workspace';
import type { Device } from './device';

@Entity('key')
export class Key extends ModelBase {
  declare readonly id: UUID;
  declare readonly workspaceId: UUID;
  declare readonly label: string;
  declare readonly uidHash: string;
  declare readonly createdAt: string;

  @ManyToOne('workspace', 'workspaceId') accessor workspace!: Workspace | undefined;
  @ManyToMany('keyAccess', 'keyId', 'device', 'deviceId') accessor devices!: Device[];
}
