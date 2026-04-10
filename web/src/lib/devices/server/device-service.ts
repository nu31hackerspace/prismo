import { devicesCol, ObjectId } from '$lib/server/db';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { createDeviceMqttUser, updateDeviceMqttPassword } from './mqtt-admin';

function generateDeviceSlug(name: string): string {
	const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const suffix = crypto.randomBytes(3).toString('hex');
	return `${base}-${suffix}`;
}

/**
 * Derives the MQTT password from the signing key stored in the DB.
 * The key alone is not the password — SESSION_SECRET is also required,
 * so a DB leak does not expose working MQTT credentials.
 */
function deriveMqttPassword(tokenKey: string): string {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET env var is not set');
	return jwt.sign({ tokenKey: tokenKey }, secret, { noTimestamp: true });
}

export async function createDevice(userId: string, name: string) {
	const tokenKey = crypto.randomBytes(4).toString('hex');
	const deviceSlug = generateDeviceSlug(name);
	const mqttPassword = deriveMqttPassword(tokenKey);

	await createDeviceMqttUser(deviceSlug, mqttPassword);

	const result = await devicesCol.insertOne({
		name,
		deviceSlug,
		ownerId: new ObjectId(userId),
		tokenKey,
		createdAt: new Date()
	});

	return { id: result.insertedId.toHexString(), name, deviceSlug };
}

export async function generateMqttCredentials(deviceId: string, userId: string) {
	const device = await devicesCol.findOne({
		_id: new ObjectId(deviceId),
		ownerId: new ObjectId(userId)
	});

	if (!device) throw new Error('Device not found or not owned by user');

	const tokenKey = crypto.randomBytes(4).toString('hex');
	const mqttPassword = deriveMqttPassword(tokenKey);

	await updateDeviceMqttPassword(device.deviceSlug, mqttPassword);

	await devicesCol.updateOne(
		{ _id: new ObjectId(deviceId) },
		{ $set: { tokenKey } }
	);

	return {
		mqttUser: device.deviceSlug,
		mqttPass: mqttPassword
	};
}
