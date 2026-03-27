import { db } from './db';
import { devices } from './db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

function getSecret(): string {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET env var is not set');
	return secret;
}

export async function createDevice(userId: number, name: string) {
	const tokenKey = crypto.randomBytes(32).toString('hex');
	const [newDevice] = await db.insert(devices).values({
		name,
		ownerId: userId,
		tokenKey,
	}).returning();
	return newDevice;
}

export async function generateDeviceToken(deviceId: number, userId: number) {
	const tokenKey = crypto.randomBytes(32).toString('hex');
	
	const [updatedDevice] = await db.update(devices)
		.set({ tokenKey })
		.where(and(eq(devices.id, deviceId), eq(devices.ownerId, userId)))
		.returning();

	if (!updatedDevice) throw new Error('Device not found or not owned by user');

	const token = jwt.sign(
		{ deviceId, tokenKey },
		getSecret()
	);

	return token;
}
