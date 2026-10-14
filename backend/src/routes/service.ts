import { Router } from 'express';
import type { MqttClient } from 'mqtt';
import { pool } from '@/db/pg';

export function createServiceRouter(mqttClient: MqttClient | undefined) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const db = await pool.query('SELECT 1').then(
      () => ({ ok: true }),
      (err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    const mqtt = mqttClient
      ? { ok: mqttClient.connected }
      : { ok: false, error: 'MQTT_URL not set' };

    res.json({ commit: process.env.COMMIT_SHA ?? 'unknown', db, mqtt });
  });

  return router;
}
