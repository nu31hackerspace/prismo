import type { UUID } from '@prismo/shared/entities';
import { Entity, ModelBase } from './base';
import { OneToMany } from './relations';
import type { Device } from './device';
import type { Key } from './key';

@Entity('workspace')
export class Workspace extends ModelBase {
  declare readonly id: UUID;
  declare readonly name: string;

  @OneToMany('device', 'workspaceId') accessor devices!: Device[];
  @OneToMany('key', 'workspaceId') accessor keys!: Key[];
}
