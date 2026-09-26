import type { UUID } from '@prismo/shared/entities';
import type { ModelBase } from './base';
import type { ModelMap } from './index';

// @ManyToOne('workspace', 'workspaceId') on Device.workspace:
// looks up the single parent by the FK value held on this record.
export function ManyToOne<K extends keyof ModelMap, This extends ModelBase>(target: K, fk: string) {
  return function(
    _init: ClassAccessorDecoratorTarget<This, ModelMap[K] | undefined>,
    _context: ClassAccessorDecoratorContext<This, ModelMap[K] | undefined>,
  ): ClassAccessorDecoratorResult<This, ModelMap[K] | undefined> {
    return {
      get(this: This) {
        const id = (this as unknown as Record<string, UUID | undefined>)[fk];
        return id ? this.store.get(target, id) : undefined;
      },
      set() {
        throw new Error(`relation "${target}" is read-only`);
      },
    };
  };
}

// @OneToMany('device', 'workspaceId') on Workspace.devices:
// every record of `target` whose `fk` field points back at this id.
export function OneToMany<K extends keyof ModelMap, This extends ModelBase & { id: UUID }>(target: K, fk: string) {
  return function(
    _init: ClassAccessorDecoratorTarget<This, ModelMap[K][]>,
    _context: ClassAccessorDecoratorContext<This, ModelMap[K][]>,
  ): ClassAccessorDecoratorResult<This, ModelMap[K][]> {
    return {
      get(this: This) {
        return this.store
          .allOf(target)
          .filter((e) => (e as unknown as Record<string, UUID>)[fk] === this.id);
      },
      set() {
        throw new Error(`relation "${target}" is read-only`);
      },
    };
  };
}

// @ManyToMany('keyAccess', 'deviceId', 'key', 'keyId') on Device.keys:
// every `target` reachable through a `join` row where join[selfFk] is this
// id — resolved to the target entity via join[targetFk].
export function ManyToMany<J extends keyof ModelMap, K extends keyof ModelMap, This extends ModelBase & { id: UUID }>(
  join: J,
  selfFk: string,
  target: K,
  targetFk: string,
) {
  return function(
    _init: ClassAccessorDecoratorTarget<This, ModelMap[K][]>,
    _context: ClassAccessorDecoratorContext<This, ModelMap[K][]>,
  ): ClassAccessorDecoratorResult<This, ModelMap[K][]> {
    return {
      get(this: This) {
        return this.store
          .allOf(join)
          .filter((row) => (row as unknown as Record<string, UUID>)[selfFk] === this.id)
          .map((row) => this.store.get(target, (row as unknown as Record<string, UUID>)[targetFk]))
          .filter((e): e is ModelMap[K] => e !== undefined);
      },
      set() {
        throw new Error(`relation "${target}" is read-only`);
      },
    };
  };
}
