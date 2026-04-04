import { db } from '$lib/server/db';
import { devices } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { createDeviceMqttUser, updateDeviceMqttPassword } from './mqtt-admin';

function generateDeviceSlug(name: string): string {
	const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const suffix = crypto.randomBytes(3).toString('hex');
	return `${base}-${suffix}`;
}

export async function createDevice(userId: number, name: string) {
	const tokenKey = crypto.randomBytes(32).toString('hex');
	const deviceSlug = generateDeviceSlug(name);

	await createDeviceMqttUser(deviceSlug, tokenKey);

	const [newDevice] = await db
		.insert(devices)
		.values({
			name,
			deviceSlug,
			ownerId: userId,
			tokenKey
		})
		.returning();
	return newDevice;
}

export async function generateMqttCredentials(deviceId: number, userId: number) {
	const [device] = await db
		.select()
		.from(devices)
		.where(and(eq(devices.id, deviceId), eq(devices.ownerId, userId)));

	if (!device) throw new Error('Device not found or not owned by user');

	const tokenKey = crypto.randomBytes(32).toString('hex');

	await updateDeviceMqttPassword(device.deviceSlug, tokenKey);

	const [updatedDevice] = await db
		.update(devices)
		.set({ tokenKey })
		.where(and(eq(devices.id, deviceId), eq(devices.ownerId, userId)))
		.returning();

	return {
		mqttUser: updatedDevice.deviceSlug,
		mqttPass: tokenKey
	};
}
