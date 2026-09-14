import type { EntityName, EntityMap, UUID } from './entities';

export type WireEntity = {
  [K in EntityName]: { entity: K; data: EntityMap[K] };
}[EntityName];

export interface SnapshotMessage {
  seq: number;
  entities: WireEntity[];
}

export type Change =
  | { op: 'upsert'; entity: EntityName; data: EntityMap[EntityName] }
  | { op: 'delete'; entity: EntityName; id: UUID };

export interface ChangeBatch {
  seq: number;
  changes: Change[];
}

// A client asks to resync by sending its last known seq. `seq: 0` (first-ever
// connect) always gets a full snapshot; any other seq gets a delta — the
// tombstones from soft-deleted rows mean a delta is valid no matter how far
// behind the client is, since nothing is ever pruned.
export interface ResyncRequest {
  seq: number;
}

export type ResyncResult =
  | { kind: 'snapshot'; snapshot: SnapshotMessage }
  | { kind: 'delta'; batch: ChangeBatch };
