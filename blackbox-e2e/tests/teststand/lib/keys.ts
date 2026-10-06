/**
 * Bulk key management through the same entities API the web app uses
 * (POST/DELETE /api/entities), plus the hashing the firmware applies to an
 * emulated tag so specs can predict uid hashes and allowlist checksums.
 */
import crypto from "node:crypto";
import { expect, type Page } from "@playwright/test";

export type StandKey = {
  tagUid: string;
  uidHash: string;
  label: string;
  keyId: string;
  keyAccessId: string;
};

/**
 * Hash the reader computes for an emulated tag: the PN532 emulator presents
 * NFCID1 0x08 + the 3 given bytes, and firmware/src/reader.py hashes the
 * lowercase hex string of the full UID.
 */
export function tagUidHash(tagUid: string): string {
  return crypto
    .createHash("sha256")
    .update(`08${tagUid.toLowerCase()}`)
    .digest("hex");
}

/** Same checksum the device reports as keys_checksum in its heartbeat. */
export function keysChecksum(uidHashes: string[]): string {
  return crypto
    .createHash("sha256")
    .update([...uidHashes].sort().join(","))
    .digest("hex");
}

/** `count` distinct 3-byte tag UIDs, starting from a timestamp-derived base. */
export function tagUidRange(count: number): string[] {
  const base = Date.now() & 0xffffff;
  return Array.from({ length: count }, (_, i) =>
    ((base + i) & 0xffffff).toString(16).padStart(6, "0"),
  );
}

async function workspaceHeaders(page: Page): Promise<Record<string, string>> {
  const me = await page.request.get("/api/auth/me");
  const { workspaceId } = await me.json();
  return { "X-Workspace": workspaceId };
}

async function createEntity(
  page: Page,
  headers: Record<string, string>,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await page.request.post("/api/entities", {
    headers,
    data: { type, data },
  });
  expect(res.ok(), `failed to create ${type}: ${await res.text()}`).toBe(true);
}

async function deleteEntity(
  page: Page,
  headers: Record<string, string>,
  id: string,
): Promise<void> {
  const res = await page.request.delete(`/api/entities/${id}`, { headers });
  expect(res.ok(), `failed to delete entity ${id}: ${await res.text()}`).toBe(
    true,
  );
}

/**
 * Create one named key per tag and grant each to the device — exactly the
 * key + keyAccess pair the "Grant access" button in the unknown-key callout saves.
 */
export async function grantKeys(
  page: Page,
  deviceId: string,
  tagUids: string[],
  labelPrefix: string,
): Promise<StandKey[]> {
  const headers = await workspaceHeaders(page);
  const keys: StandKey[] = [];
  for (const [i, tagUid] of tagUids.entries()) {
    const key: StandKey = {
      tagUid,
      uidHash: tagUidHash(tagUid),
      label: `${labelPrefix} #${String(i + 1).padStart(3, "0")}`,
      keyId: crypto.randomUUID(),
      keyAccessId: crypto.randomUUID(),
    };
    await createEntity(page, headers, "key", {
      id: key.keyId,
      uidHash: key.uidHash,
      label: key.label,
      createdAt: new Date().toISOString(),
    });
    await createEntity(page, headers, "keyAccess", {
      id: key.keyAccessId,
      deviceId,
      keyId: key.keyId,
    });
    keys.push(key);
  }
  return keys;
}

/** Detach keys from the device (the key entities themselves stay). */
export async function revokeKeys(page: Page, keys: StandKey[]): Promise<void> {
  const headers = await workspaceHeaders(page);
  for (const key of keys) await deleteEntity(page, headers, key.keyAccessId);
}

/** Best-effort removal of every key + grant a spec created (never throws). */
export async function deleteKeys(page: Page, keys: StandKey[]): Promise<void> {
  const headers = await workspaceHeaders(page).catch(() => undefined);
  if (!headers) return;
  for (const key of keys) {
    for (const id of [key.keyAccessId, key.keyId]) {
      await page.request
        .delete(`/api/entities/${id}`, { headers })
        .catch(() => undefined);
    }
  }
}
