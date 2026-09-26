import { computed, makeObservable, observable, type AnnotationsMap } from 'mobx';
import type { EntityName, EntityMap } from '@prismo/shared/entities';
import type { EntityStore } from '../entity-store';
import type { ModelMap } from './index';

export abstract class ModelBase {
  #rawFields: string[];

  constructor(public readonly store: EntityStore, raw: object) {
    Object.assign(this, raw);
    this.#rawFields = Object.keys(raw);

    const annotations: AnnotationsMap<this, never> = { store: false };
    for (const key of this.#rawFields) (annotations as Record<string, unknown>)[key] = observable;
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

  get entityKind(): EntityName {
    return entityKindOf(this.constructor as ModelCtor);
  }

  toRaw(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of this.#rawFields) out[key] = (this as unknown as Record<string, unknown>)[key];
    return out;
  }

  save(): this {
    this.store.put(this.entityKind, this.toRaw() as never);
    return this;
  }
}

type ModelCtor = new (store: EntityStore, raw: object) => ModelBase;

const registry = new Map<EntityName, ModelCtor>();
const entityNames = new Map<ModelCtor, EntityName>();

export function Entity(name: EntityName) {
  return function(target: ModelCtor) {
    registry.set(name, target);
    entityNames.set(target, name);
  };
}

export function modelFor(name: EntityName): ModelCtor {
  const ctor = registry.get(name);
  if (!ctor) throw new Error(`No @Entity model registered for "${name}"`);
  return ctor;
}

function entityKindOf(ctor: ModelCtor): EntityName {
  const name = entityNames.get(ctor);
  if (!name) throw new Error(`Model class "${ctor.name}" is missing @Entity(...)`);
  return name;
}

export function draft<K extends EntityName>(
  store: EntityStore,
  type: K,
  data: Omit<EntityMap[K], 'id' | 'workspaceId'>,
): ModelMap[K] {
  const workspaceId = store.workspaceId;
  if (!workspaceId) throw new Error('Cannot create an entity before the workspace has loaded');

  const raw = { id: crypto.randomUUID(), workspaceId, ...data };
  return new (modelFor(type))(store, raw) as ModelMap[K];
}

