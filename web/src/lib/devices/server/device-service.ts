import { devicesCol, ObjectId } from '$lib/server/db';
import crypto from 'crypto';
import { createDeviceMqttUser, updateDeviceMqttPassword } from './mqtt-admin';

function generateDeviceSlug(name: string): string {
	const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const suffix = crypto.randomBytes(3).toString('hex');
	return `${base}-${suffix}`;
}

export async function createDevice(userId: string, name: string) {
	const tokenKey = crypto.randomBytes(32).toString('hex');
	const deviceSlug = generateDeviceSlug(name);

	await createDeviceMqttUser(deviceSlug, tokenKey);

	const result = await devicesCol.insertOne({
		name,
		deviceSlug,
		ownerId: new ObjectId(userId),
		tokenKey,
		createdAt: new Date()
	});

	return { id: result.insertedId.toHexString(), name, deviceSlug, tokenKey };
}

export async function generateMqttCredentials(deviceId: string, userId: string) {
	const device = await devicesCol.findOne({
		_id: new ObjectId(deviceId),
		ownerId: new ObjectId(userId)
	});

	if (!device) throw new Error('Device not found or not owned by user');

	const tokenKey = crypto.randomBytes(32).toString('hex');

	await updateDeviceMqttPassword(device.deviceSlug, tokenKey);

	await devicesCol.updateOne(
		{ _id: new ObjectId(deviceId) },
		{ $set: { tokenKey } }
	);

	return {
		mqttUser: device.deviceSlug,
		mqttPass: tokenKey
	};
}
