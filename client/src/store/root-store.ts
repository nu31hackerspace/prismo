import { makeAutoObservable } from 'mobx';
import type { Socket } from 'socket.io-client';
import type { SnapshotMessage, ChangeBatch } from '@prismo/shared/sync';
import { EntityStore } from './entity-store';
import type { Workspace, Device, Key } from './models';

export class RootStore {
  entities = new EntityStore();
  ready = false;
  connected = false;
  socket: Socket | null = null;

  constructor() {
    makeAutoObservable(this, { socket: false });
  }

  loadSnapshot(snap: SnapshotMessage) {
    this.entities.loadSnapshot(snap);
    this.ready = true;
  }

  applyBatch(batch: ChangeBatch) {
    this.entities.applyBatch(batch);
  }

  // The socket connection is already scoped to one workspace server-side, so
  // exactly one `workspace` record ever lands in the store. `.devices`/
  // `.keys`/each device's `.workspace` back-reference are annotated
  // relations resolved live off `entities` — see ./models.
  get workspace(): Workspace | undefined {
    return this.entities.allOf('workspace')[0];
  }

  get allDevices(): Device[] {
    return this.workspace?.devices ?? [];
  }

  get allKeys(): Key[] {
    return this.workspace?.keys ?? [];
  }
}
