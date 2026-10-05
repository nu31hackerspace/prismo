// Backend-only tests for how the backend reacts to device MQTT messages.
//
// Needs Postgres (POSTGRES_URL). The first group drives the message handler
// directly; the second publishes through a real broker (MQTT_URL, USERNAME,
// PASSWORD) and proves every message reaches the database. Both groups skip
// when their infrastructure is not configured — CI provides it (web-check.yml).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import mqtt from 'mqtt';
import { pool } from '@/db/pg';
import { migrate } from '@/db/migrate';
import { insertEntity } from '@/db/entities';
import { createMessageHandler, initializeScanListener } from './scan-listener';

const hasDb = !!process.env.POSTGRES_URL;
const hasBroker = hasDb && !!process.env.MQTT_URL;

interface Fixture {
  workspaceId: string;
  deviceId: string;
  keyId: string;
  uidHash: string;
}

async function createFixture(): Promise<Fixture> {
  const { rows: [ws] } = await pool.query<{ id: string }>(
    `INSERT INTO workspace (name) VALUES ($1) RETURNING id`,
    [`scan-listener-test ${randomUUID()}`],
  );
  const workspaceId = ws.id;
  const device = await insertEntity(pool, workspaceId, 'device', {
    name: 'Test device', mode: 'door', modeParams: {}, lastSeenAt: null,
  }, 0);
  const uidHash = `uid-${randomUUID()}`;
  const key = await insertEntity(pool, workspaceId, 'key', {
    label: 'Test key', uidHash, createdAt: new Date().toISOString(),
  }, 0);
  return { workspaceId, deviceId: device!.id, keyId: key!.id, uidHash };
}

async function scans(deviceId: string) {
  const { rows } = await pool.query<{ data: Record<string, unknown> }>(
    `SELECT data FROM entities
     WHERE type = 'deviceActivity' AND data->>'deviceId' = $1 AND data->>'kind' = 'scan'
     ORDER BY created_at`,
    [deviceId],
  );
  return rows.map((r) => r.data);
}

async function waitFor<T>(fn: () => Promise<T>, done: (v: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (done(v) || Date.now() > deadline) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
}

const checksum = (uids: string[]) => createHash('sha256').update([...uids].sort().join(',')).digest('hex');
const json = (v: unknown) => Buffer.from(JSON.stringify(v));

describe('scan-listener message handler', { skip: !hasDb && 'POSTGRES_URL not set' }, () => {
  const synced: string[] = [];
  const handle = createMessageHandler({ pushDeviceSync: async (id) => { synced.push(id); } });

  before(async () => { await migrate(); });
  after(async () => { if (!hasBroker) await pool.end(); });

  test('allowed scan of a known key is recorded and resolved to the key', async () => {
    const f = await createFixture();
    await handle(`prismo/${f.deviceId}/scan`, json({ uid: f.uidHash, allowed: true }));
    const rows = await scans(f.deviceId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].keyId, f.keyId);
    assert.equal(rows[0].uidHash, f.uidHash);
    assert.equal(rows[0].allowed, true);
  });

  test('scan of an unknown uid is recorded as denied with no key', async () => {
    const f = await createFixture();
    await handle(`prismo/${f.deviceId}/scan`, json({ uid: 'never-granted', allowed: false }));
    const [row] = await scans(f.deviceId);
    assert.equal(row.keyId, null);
    assert.equal(row.allowed, false);
  });

  test('a revoked (soft-deleted) key is not resolved', async () => {
    const f = await createFixture();
    await pool.query(`UPDATE entities SET deleted = true WHERE id = $1`, [f.keyId]);
    await handle(`prismo/${f.deviceId}/scan`, json({ uid: f.uidHash, allowed: false }));
    const [row] = await scans(f.deviceId);
    assert.equal(row.keyId, null);
  });

  test('a burst of concurrent scans is recorded without loss', async () => {
    const f = await createFixture();
    const n = 50;
    await Promise.all(
      Array.from({ length: n }, () => handle(`prismo/${f.deviceId}/scan`, json({ uid: f.uidHash, allowed: true }))),
    );
    assert.equal((await scans(f.deviceId)).length, n);
  });

  test('bad input is ignored without throwing or recording anything', async () => {
    const f = await createFixture();
    await handle(`prismo/${f.deviceId}/scan`, Buffer.from('{not json'));
    await handle(`prismo/${f.deviceId}/scan`, Buffer.from('null'));
    await handle(`prismo/${randomUUID()}/scan`, json({ uid: f.uidHash, allowed: true })); // unknown device
    await handle(`prismo/not-a-uuid/scan`, json({ uid: f.uidHash, allowed: true }));
    await handle(`prismo/${f.deviceId}/scan/extra`, json({ uid: f.uidHash, allowed: true }));
    await handle(`other/${f.deviceId}/scan`, json({ uid: f.uidHash, allowed: true }));
    await handle(`prismo/${f.deviceId}/cmd`, json({}));
    assert.equal((await scans(f.deviceId)).length, 0);
  });

  test('a scan on another workspace\'s key does not resolve across workspaces', async () => {
    const a = await createFixture();
    const b = await createFixture();
    await handle(`prismo/${b.deviceId}/scan`, json({ uid: a.uidHash, allowed: true }));
    const [row] = await scans(b.deviceId);
    assert.equal(row.keyId, null);
  });

  test('heartbeat updates lastSeenAt', async () => {
    const f = await createFixture();
    await handle(`prismo/${f.deviceId}/status`, json({ online: true, keys_checksum: checksum([]) }));
    const { rows: [d] } = await pool.query(`SELECT data->>'lastSeenAt' AS seen FROM entities WHERE id = $1`, [f.deviceId]);
    assert.ok(d.seen, 'lastSeenAt was not set');
  });

  test('heartbeat with a matching keys_checksum does not push a sync', async () => {
    const f = await createFixture();
    await insertEntity(pool, f.workspaceId, 'keyAccess', { deviceId: f.deviceId, keyId: f.keyId }, 0);
    synced.length = 0;
    await handle(`prismo/${f.deviceId}/status`, json({ online: true, keys_checksum: checksum([f.uidHash]) }));
    assert.deepEqual(synced, []);
  });

  test('heartbeat with a stale keys_checksum pushes exactly one sync', async () => {
    const f = await createFixture();
    await insertEntity(pool, f.workspaceId, 'keyAccess', { deviceId: f.deviceId, keyId: f.keyId }, 0);
    synced.length = 0;
    await handle(`prismo/${f.deviceId}/status`, json({ online: true, keys_checksum: checksum([]) }));
    assert.deepEqual(synced, [f.deviceId]);
  });

  test('heartbeat without keys_checksum or with bad JSON never pushes a sync', async () => {
    const f = await createFixture();
    synced.length = 0;
    await handle(`prismo/${f.deviceId}/status`, json({ online: true }));
    await handle(`prismo/${f.deviceId}/status`, Buffer.from('garbage'));
    assert.deepEqual(synced, []);
  });
});

describe('scan-listener over a real broker', { skip: !hasBroker && 'POSTGRES_URL / MQTT_URL not set' }, () => {
  let listener: mqtt.MqttClient | undefined;
  let publisher: mqtt.MqttClient;

  before(async () => {
    await migrate();
    listener = initializeScanListener();
    assert.ok(listener, 'listener did not start');
    // Wait for the SUBACK so published messages cannot race the subscription.
    await new Promise<void>((resolve, reject) => {
      listener!.once('error', reject);
      listener!.once('packetreceive', function onPacket(p: { cmd: string }) {
        if (p.cmd === 'suback') resolve(); else listener!.once('packetreceive', onPacket);
      });
    });
    publisher = await mqtt.connectAsync(process.env.MQTT_URL!, {
      username: process.env.USERNAME,
      password: process.env.PASSWORD,
    });
  });

  after(async () => {
    await publisher?.endAsync();
    await listener?.endAsync();
    await pool.end();
  });

  test('every scan published at QoS 1 is observed and stored', async () => {
    const f = await createFixture();
    const n = 50;
    await Promise.all(
      Array.from({ length: n }, () =>
        publisher.publishAsync(`prismo/${f.deviceId}/scan`, JSON.stringify({ uid: f.uidHash, allowed: true }), { qos: 1 })),
    );
    const rows = await waitFor(() => scans(f.deviceId), (r) => r.length >= n);
    assert.equal(rows.length, n, `backend stored ${rows.length}/${n} published scans`);
    assert.ok(rows.every((r) => r.keyId === f.keyId));
  });

  test('scans keep flowing for several devices at once', async () => {
    const fixtures = await Promise.all([createFixture(), createFixture(), createFixture()]);
    const each = 20;
    await Promise.all(fixtures.flatMap((f) =>
      Array.from({ length: each }, () =>
        publisher.publishAsync(`prismo/${f.deviceId}/scan`, JSON.stringify({ uid: f.uidHash, allowed: true }), { qos: 1 }))));
    for (const f of fixtures) {
      const rows = await waitFor(() => scans(f.deviceId), (r) => r.length >= each);
      assert.equal(rows.length, each, `device ${f.deviceId}: ${rows.length}/${each}`);
    }
  });

  test('a heartbeat over the broker updates lastSeenAt', async () => {
    const f = await createFixture();
    await publisher.publishAsync(`prismo/${f.deviceId}/status`,
      JSON.stringify({ online: true, keys_checksum: checksum([]) }), { qos: 1 });
    const seen = await waitFor(async () => {
      const { rows: [d] } = await pool.query(`SELECT data->>'lastSeenAt' AS seen FROM entities WHERE id = $1`, [f.deviceId]);
      return d.seen as string | null;
    }, Boolean);
    assert.ok(seen, 'lastSeenAt was not set');
  });
});
