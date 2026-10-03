export type UUID = string;

export interface Workspace {
  id: UUID;
  name: string;
}

export interface Device {
  id: UUID;
  workspaceId: UUID;
  name: string;
  mode: string;
  modeParams: { isOn?: boolean };
  lastSeenAt: string | null;
}

export interface Key {
  id: UUID;
  workspaceId: UUID;
  label: string;
  uidHash: string;
  createdAt: string;
}

export interface KeyAccess {
  id: UUID;
  workspaceId: UUID;
  deviceId: UUID;
  keyId: UUID;
}

export type ActionKind = 'scan' | 'trigger' | 'key_added' | 'key_removed' | 'sync';

// A device activity entry (scan, trigger, key add/remove, forced sync).
// Append-only — nothing ever updates or deletes an existing row — but it's
// an entity like any other: it rides in the workspace snapshot and in
// deltas, keyed by its own id.
export interface DeviceActivity {
  id: UUID;
  workspaceId: UUID;
  deviceId: UUID;
  kind: ActionKind;
  uidHash: string | null;       // raw card uid; set for scan/key_added/key_removed
  keyId: UUID | null;           // resolved key entity, when the uid is known
  allowed: boolean | null;      // 'scan' only
  triggerAction: string | null; // 'trigger' only
  createdAt: string;
}

export const ENTITY_NAMES = ['workspace', 'device', 'key', 'keyAccess', 'deviceActivity'] as const;

export type EntityName = (typeof ENTITY_NAMES)[number];

export interface EntityMap {
  workspace: Workspace;
  device: Device;
  key: Key;
  keyAccess: KeyAccess;
  deviceActivity: DeviceActivity;
}

export function isEntityName(type: unknown): type is EntityName {
  return ENTITY_NAMES.includes(type as EntityName);
}
