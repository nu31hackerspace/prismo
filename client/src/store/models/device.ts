import type { UUID } from '@prismo/shared/entities';
import { Entity, ModelBase } from './base';
import { ManyToOne, ManyToMany, OneToMany } from './relations';
import { clock } from '../clock';
import type { Workspace } from './workspace';
import type { Key } from './key';
import type { DeviceActivity } from './device-activity';
import type { Hook } from './hook';

const OFFLINE_AFTER_MS = 15_000;

@Entity('device')
export class Device extends ModelBase {
  declare readonly id: UUID;
  declare readonly workspaceId: UUID;
  declare readonly name: string;
  declare readonly mode: string;
  declare readonly modeParams: { isOn?: boolean };
  declare readonly lastSeenAt: string | null;

  @ManyToOne('workspace', 'workspaceId') accessor workspace!: Workspace | undefined;
  @ManyToMany('keyAccess', 'deviceId', 'key', 'keyId') accessor keys!: Key[];
  @OneToMany('deviceActivity', 'deviceId') accessor activityRecords!: DeviceActivity[];
  @OneToMany('hook', 'deviceId') accessor hooks!: Hook[];

  get online(): boolean {
    return this.lastSeenAt !== null && clock.now - Date.parse(this.lastSeenAt) < OFFLINE_AFTER_MS;
  }

  get activity(): DeviceActivity[] {
    return [...this.activityRecords].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}
