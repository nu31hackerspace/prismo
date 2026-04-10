import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import { env } from '$env/dynamic/private';
import type { UserDocument, TrackingDocument, DeviceDocument, WorkerJobDocument, DeviceKeyDocument, DeviceHistoryDocument } from './schema';

const client = new MongoClient(env.MONGODB_URL!);
await client.connect();

const database = client.db('prismo');

export const usersCol = database.collection<UserDocument>('users');
export const trackingCol = database.collection<TrackingDocument>('tracking');
export const devicesCol = database.collection<DeviceDocument>('devices');
export const workerJobsCol = database.collection<WorkerJobDocument>('worker_jobs');
export const deviceKeysCol = database.collection<DeviceKeyDocument>('device_keys');
export const deviceHistoryCol = database.collection<DeviceHistoryDocument>('device_history');
export const firmwareBucket = new GridFSBucket(database, { bucketName: 'firmware' });
export { ObjectId };

async function ensureIndexes() {
	try {
		await devicesCol.createIndex({ tokenKey: 1 }, { unique: true });
		await devicesCol.createIndex({ deviceSlug: 1 }, { unique: true });
		await devicesCol.createIndex({ lastSeenAt: 1 }, { sparse: true });

		await deviceKeysCol.createIndex({ deviceId: 1 });
		await deviceKeysCol.createIndex({ deviceId: 1, keyId: 1 }, { unique: true });

		await deviceHistoryCol.createIndex({ deviceId: 1, createdAt: -1 });
		await deviceHistoryCol.createIndex({ deviceSlug: 1, createdAt: -1 });
		await deviceHistoryCol.createIndex(
			{ deviceId: 1, createdAt: -1 },
			{ partialFilterExpression: { action: 'scan', allowed: false }, name: 'device_id_unauth_scans' }
		);
	} catch (error) {
		console.error('Failed to create MongoDB indexes:', error);
	}
}

await ensureIndexes();
