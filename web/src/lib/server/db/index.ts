import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import { env } from '$env/dynamic/private';
import type { UserDocument, TrackingDocument, DeviceDocument, WorkerJobDocument } from './schema';

const client = new MongoClient(env.MONGODB_URL!);
await client.connect();

const database = client.db('prismo');

export const usersCol = database.collection<UserDocument>('users');
export const trackingCol = database.collection<TrackingDocument>('tracking');
export const devicesCol = database.collection<DeviceDocument>('devices');
export const workerJobsCol = database.collection<WorkerJobDocument>('worker_jobs');
export const firmwareBucket = new GridFSBucket(database, { bucketName: 'firmware' });
export { ObjectId };

async function ensureIndexes() {
	try {
		await devicesCol.createIndex({ tokenKey: 1 }, { unique: true });
		await devicesCol.createIndex({ deviceSlug: 1 }, { unique: true });
	} catch (error) {
		console.error('Failed to create MongoDB indexes:', error);
	}
}

await ensureIndexes();
