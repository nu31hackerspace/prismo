import type { UUID } from '@prismo/shared/entities';
import type { Change } from '@prismo/shared/sync';

export type EntityChangeEvent = Change & { workspaceId: UUID };
export type EntityChangeHandler = (change: EntityChangeEvent) => void;

const handlers: EntityChangeHandler[] = [];

export function onEntityChange(handler: EntityChangeHandler): void {
  handlers.push(handler);
}

export function dispatchEntityChanges(workspaceId: UUID, changes: Change[]): void {
  for (const change of changes) {
    const event: EntityChangeEvent = { ...change, workspaceId };
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[hooks] entity change handler failed:', err);
      }
    }
  }
}

