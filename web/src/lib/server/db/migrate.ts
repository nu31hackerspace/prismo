import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.MONGODB_URL) {
  throw new Error('MONGODB_URL is not set');
}

const client = new MongoClient(process.env.MONGODB_URL);

async function main() {
  console.log('Running database setup...');
  await client.connect();
  const db = client.db('prismo');

  const users = db.collection('users');
  await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  await users.createIndex({ email: 1 }, { unique: true });

  const devices = db.collection('devices');
  await devices.createIndex({ deviceSlug: 1 }, { unique: true });
  await devices.createIndex({ ownerId: 1 });

  const workerJobs = db.collection('worker_jobs');
  await workerJobs.createIndex({ status: 1, createdAt: 1 });
  await workerJobs.createIndex({ ownerId: 1 });

  const tracking = db.collection('tracking');
  await tracking.createIndex({ deviceUuid: 1 });
  await tracking.createIndex({ createdAt: 1 });

  const deviceKeys = db.collection('device_keys');
  await deviceKeys.createIndex({ deviceId: 1 });
  await deviceKeys.createIndex({ deviceId: 1, keyId: 1 }, { unique: true });

  const deviceHistory = db.collection('device_history');
  await deviceHistory.createIndex({ deviceId: 1, createdAt: -1 });
  await deviceHistory.createIndex({ deviceSlug: 1, createdAt: -1 });
  await deviceHistory.createIndex(
    { deviceId: 1, createdAt: -1 },
    { partialFilterExpression: { action: 'scan', allowed: false }, name: 'device_id_unauth_scans' }
  );

  console.log('Database setup complete!');
  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
