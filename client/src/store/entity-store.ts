import { makeAutoObservable, observable, runInAction } from 'mobx';
import type { UUID, EntityName } from '@prismo/shared/entities';
import type { SnapshotMessage, ChangeBatch, WireEntity } from '@prismo/shared/sync';
import { modelFor } from './models/base';
import type { ModelMap } from './models';
import './models'; // side-effect import: runs @Entity(...) registration

// Root store: one flat map of every synced record, keyed by id. Records keep
// their `entity` tag from the wire so the next layer (views.ts) can filter
// by type and build normal, typed entities out of this flat pool.
export class EntityStore {
  records = observable.map<UUID, WireEntity>();

  lastSeq = 0;

  constructor() {
    makeAutoObservable(this);
  }

  loadSnapshot(snap: SnapshotMessage) {
    runInAction(() => {
      const incomingIds = new Set<UUID>();
      for (const wire of snap.entities) {
        if (wire.entity === 'user') continue;
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
        if (c.entity === 'user') continue;
        if (c.op === 'upsert') this.records.set(c.data.id, { entity: c.entity, data: c.data } as WireEntity);
        else this.records.delete(c.id);
      }
      this.lastSeq = batch.seq;
    });
  }

  // Hydrates the raw wire record for `id` into its annotated model instance
  // (see ./models), or undefined if there's no such record or it's a
  // different type. Used by @ManyToOne getters to resolve a parent.
  get<K extends keyof ModelMap>(type: K, id: UUID): ModelMap[K] | undefined {
    const rec = this.records.get(id);
    if (!rec || rec.entity !== type) return undefined;
    return new (modelFor(type as EntityName))(this, rec.data) as ModelMap[K];
  }

  // All records of `type`, hydrated into model instances. Used by
  // @OneToMany getters to resolve children. Rebuilt fresh on every call
  // (like the plain views.ts builders) — fine at this data scale, and it's
  // always read inside a reactive (MobX-tracked) context.
  allOf<K extends keyof ModelMap>(type: K): ModelMap[K][] {
    const Ctor = modelFor(type as EntityName);
    const out: ModelMap[K][] = [];
    for (const rec of this.records.values()) {
      if (rec.entity === type) out.push(new Ctor(this, rec.data) as ModelMap[K]);
    }
    return out;
  }
}
