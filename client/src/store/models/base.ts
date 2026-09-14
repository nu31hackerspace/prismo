import { computed, makeObservable, observable, type AnnotationsMap } from 'mobx';
import type { EntityName } from '@prismo/shared/entities';
import type { EntityStore } from '../entity-store';

// Base class for annotated entity models. Field values (id, name, ...) are
// copied onto the instance as-is from the raw wire record; relation fields
// (see relations.ts) are never part of `raw` — they're computed getters
// installed by @OneToMany/@ManyToOne/@ManyToMany, resolved lazily against
// `store`. Every concrete model (Device, Workspace, ...) extends this class,
// so `makeAutoObservable` is off the table — it refuses to run on anything
// with a superclass, since it can't safely auto-infer members it finds
// further up the prototype chain. We build the same effect by hand instead:
// annotate the raw data fields (assigned above) as `observable`, and walk
// the prototype chain up to (but excluding) ModelBase, marking every getter
// found there — TC39 accessor decorators compile relation fields down to
// plain prototype get/set pairs, indistinguishable here from a hand-written
// `get` — as `computed`. This is what makes a freshly `new Device(store,
// data)` — e.g. a locally created, not-yet-synced draft, not just one
// hydrated from the store — reactive out of the box: mutating a field on it
// (`device.name = 'x'`) notifies observers immediately, without waiting for
// a round trip through the wire protocol.
export abstract class ModelBase {
  constructor(public readonly store: EntityStore, raw: object) {
    Object.assign(this, raw);

    const annotations: AnnotationsMap<this, never> = { store: false };
    for (const key of Object.keys(raw)) (annotations as Record<string, unknown>)[key] = observable;
    for (
      let proto: object | null = Object.getPrototypeOf(this);
      proto && proto !== ModelBase.prototype;
      proto = Object.getPrototypeOf(proto)
    ) {
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
        if (descriptor.get) (annotations as Record<string, unknown>)[key] ??= computed;
      }
    }

    makeObservable(this, annotations);
  }
}

type ModelCtor = new (store: EntityStore, raw: object) => ModelBase;

const registry = new Map<EntityName, ModelCtor>();

// Class decorator: @Entity('device') registers the model class as the one
// EntityStore hydrates wire records of that type into.
export function Entity(name: EntityName) {
  return function (target: ModelCtor) {
    registry.set(name, target);
  };
}

export function modelFor(name: EntityName): ModelCtor {
  const ctor = registry.get(name);
  if (!ctor) throw new Error(`No @Entity model registered for "${name}"`);
  return ctor;
}
