import { makeAutoObservable, observable, runInAction } from 'mobx';
import type { UUID, EntityName, EntityMap } from '@prismo/shared/entities';
import type { SnapshotMessage, ChangeBatch, WireEntity } from '@prismo/shared/sync';
import { modelFor } from './models/base';
import type { ModelMap } from './models';
import './models'; // side-effect import: runs @Entity(...) registration
import { SyncOutbox } from './sync-outbox';

export class EntityStore {
  records = observable.map<UUID, WireEntity>();
  outbox = new SyncOutbox();

  lastSeq = 0;

  constructor() {
    makeAutoObservable(this, { outbox: false });
  }

  get workspaceId(): UUID | undefined {
    return this.allOf('workspace')[0]?.id;
  }

  put<K extends EntityName>(entity: K, data: EntityMap[K]): void {
    runInAction(() => {
      this.records.set((data as { id: UUID }).id, { entity, data } as WireEntity);
    });
    this.outbox.enqueue(entity, data as unknown as Record<string, unknown>);
  }

  loadSnapshot(snap: SnapshotMessage) {
    runInAction(() => {
      const incomingIds = new Set<UUID>();
      for (const wire of snap.entities) {
        incomingIds.add(wire.data.id);
        this.records.set(wire.data.id, wire);
      }
      for (const id of this.records.keys()) if (!incomingIds.has(id)) this.records.delete(id);
      this.lastSeq = snap.seq;
    });
  }

  applyBatch(batch: ChangeBatch) {
    runInAction(() => {
      for (const c of batch.changes) {
        if (c.op === 'upsert') this.records.set(c.id, { entity: c.entity, data: c.data } as WireEntity);
        else this.records.delete(c.id);
      }
      this.lastSeq = batch.seq;
    });
  }

  get<K extends keyof ModelMap>(type: K, id: UUID): ModelMap[K] | undefined {
    const rec = this.records.get(id);
    if (!rec || rec.entity !== type) return undefined;
    return new (modelFor(type as EntityName))(this, rec.data) as ModelMap[K];
  }

  allOf<K extends keyof ModelMap>(type: K): ModelMap[K][] {
    const Ctor = modelFor(type as EntityName);
    const out: ModelMap[K][] = [];
    for (const rec of this.records.values()) {
      if (rec.entity === type) out.push(new Ctor(this, rec.data) as ModelMap[K]);
    }
    return out;
  }
}
