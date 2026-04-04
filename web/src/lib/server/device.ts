import { db } from './db';
import { devices } from './db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

function generateDeviceSlug(name: string): string {
	const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const suffix = crypto.randomBytes(3).toString('hex');
	return `${base}-${suffix}`;
}

export async function createDevice(userId: number, name: string) {
	const tokenKey = crypto.randomBytes(32).toString('hex');
	const deviceSlug = generateDeviceSlug(name);
	const [newDevice] = await db.insert(devices).values({
		name,
		deviceSlug,
		ownerId: userId,
		tokenKey,
	}).returning();
	return newDevice;
}

export async function generateMqttCredentials(deviceId: number, userId: number) {
	const tokenKey = crypto.randomBytes(32).toString('hex');

	const [updatedDevice] = await db.update(devices)
		.set({ tokenKey })
		.where(and(eq(devices.id, deviceId), eq(devices.ownerId, userId)))
		.returning();

	if (!updatedDevice) throw new Error('Device not found or not owned by user');

	return {
		mqttUser: updatedDevice.deviceSlug,
		mqttPass: tokenKey,
	};
}
