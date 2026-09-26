import { makeAutoObservable, runInAction } from 'mobx';
import type { EntityName, UUID } from '@prismo/shared/entities';
import { workspaceHeader } from './workspace-id';

interface PendingChange {
  id: UUID;
  entity: EntityName;
  data: Record<string, unknown>;
}

export class SyncOutbox {
  pending: PendingChange[] = [];
  private flushing = false;

  constructor() {
    makeAutoObservable(this);
  }

  enqueue(entity: EntityName, data: Record<string, unknown>): void {
    this.pending.push({ id: data.id as UUID, entity, data });
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.pending.length > 0) {
        const task = this.pending[0];
        try {
          await postEntity(task.entity, task.data);
        } catch (err) {
          console.error('[sync-outbox] push failed, will retry on reconnect:', task.entity, task.id, err);
          break;
        }
        runInAction(() => {
          if (this.pending[0]?.id === task.id) this.pending.shift();
        });
      }
    } finally {
      this.flushing = false;
    }
  }
}

async function postEntity(entity: EntityName, data: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeader() },
    body: JSON.stringify({ type: entity, data }),
  });
  if (!res.ok) throw new Error(`POST /api/entities failed: ${res.status}`);
}
