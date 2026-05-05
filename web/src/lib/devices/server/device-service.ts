import { devicesCol, deviceKeysCol, deviceHistoryCol, ObjectId } from '$lib/server/db';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { createDeviceMqttUser, updateDeviceMqttPassword, publishToDevice } from './mqtt-admin';

function generateDeviceSlug(name: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
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

	await devicesCol.updateOne({ _id: new ObjectId(deviceId) }, { $set: { tokenKey } });

	return {
		mqttUser: device.deviceSlug,
		mqttPass: mqttPassword
	};
}

async function requireOwnedDevice(deviceSlug: string, userId: string) {
	const device = await devicesCol.findOne({
		deviceSlug,
		ownerId: new ObjectId(userId)
	});
	if (!device) throw new Error('Device not found or access denied');
	return device;
}

export async function generateMqttCredentialsBySlug(deviceSlug: string, userId: string) {
	const device = await requireOwnedDevice(deviceSlug, userId);

	const tokenKey = crypto.randomBytes(4).toString('hex');
	const mqttPassword = deriveMqttPassword(tokenKey);

	await updateDeviceMqttPassword(device.deviceSlug, mqttPassword);

	await devicesCol.updateOne({ _id: device._id }, { $set: { tokenKey } });

	return {
		mqttUser: device.deviceSlug,
		mqttPass: mqttPassword
	};
}

/**
 * Pushes the complete allowed-key list to the device as a retained MQTT message.
 * The broker stores it; the device receives it automatically on every reconnect.
 * This is the "source of truth" sync — call it whenever the key list changes.
 * Internal function — no ownership check, callers are responsible for auth.
 */
async function pushRetainedSync(deviceSlug: string): Promise<void> {
	const device = await devicesCol.findOne({ deviceSlug });
	if (!device || !device._id) {
		console.warn(`[device-service] pushRetainedSync: unknown device "${deviceSlug}"`);
		return;
	}
	const keys = await deviceKeysCol.find({ deviceId: device._id }).toArray();
	console.log(`[device-service] pushing retained sync to "${deviceSlug}" (${keys.length} keys)`);
	await publishToDevice(
		deviceSlug,
		'cmd/sync',
		{ keys: keys.map((k) => ({ uid: k.keyId, username: k.username })) },
		{ retain: true }
	);
}

export async function addKeyToDevice(
	deviceSlug: string,
	userId: string,
	keyId: string,
	username: string
): Promise<void> {
	const device = await requireOwnedDevice(deviceSlug, userId);
	const deviceId = device._id!;
	const now = new Date();

	await deviceKeysCol.updateOne(
		{ deviceId, keyId },
		{ $setOnInsert: { deviceId, keyId, username, addedAt: now } },
		{ upsert: true }
	);

	await deviceHistoryCol.insertOne({
		deviceId,
		deviceSlug,
		action: 'key_added',
		keyId,
		username,
		actorUserId: new ObjectId(userId),
		createdAt: now
	});

	// Incremental: immediate effect if device is online now.
	publishToDevice(deviceSlug, 'cmd/add_key', { uid: keyId }).catch((err) =>
		console.error(`[device-service] cmd/add_key failed for "${deviceSlug}":`, err)
	);
	// Retained full sync: device receives current state on next reconnect.
	pushRetainedSync(deviceSlug).catch((err) =>
		console.error(`[device-service] retained sync failed after addKey for "${deviceSlug}":`, err)
	);
}

export async function removeKeyFromDevice(
	deviceSlug: string,
	userId: string,
	keyId: string
): Promise<void> {
	const device = await requireOwnedDevice(deviceSlug, userId);
	const deviceId = device._id!;

	const keyDoc = await deviceKeysCol.findOneAndDelete({ deviceId, keyId });
	if (!keyDoc) throw new Error('Key not found');

	await deviceHistoryCol.insertOne({
		deviceId,
		deviceSlug,
		action: 'key_removed',
		keyId,
		username: keyDoc.username,
		actorUserId: new ObjectId(userId),
		createdAt: new Date()
	});

	// Incremental: immediate effect if device is online now.
	publishToDevice(deviceSlug, 'cmd/remove_key', { uid: keyId }).catch((err) =>
		console.error(`[device-service] cmd/remove_key failed for "${deviceSlug}":`, err)
	);
	// Retained full sync: device receives current state on next reconnect.
	pushRetainedSync(deviceSlug).catch((err) =>
		console.error(`[device-service] retained sync failed after removeKey for "${deviceSlug}":`, err)
	);
}

export async function triggerDevice(
	deviceSlug: string,
	userId: string,
	action: 'success' | 'error' | 'on' | 'off'
): Promise<void> {
	const device = await requireOwnedDevice(deviceSlug, userId);
	const deviceId = device._id!;

	await publishToDevice(deviceSlug, 'cmd/trigger', { action });

	if (action === 'on') {
		await devicesCol.updateOne({ deviceSlug }, { $set: { 'modeParams.isOn': true } });
	} else if (action === 'off') {
		await devicesCol.updateOne({ deviceSlug }, { $set: { 'modeParams.isOn': false } });
	}

	await deviceHistoryCol.insertOne({
		deviceId,
		deviceSlug,
		action: 'trigger',
		triggerAction: action,
		actorUserId: new ObjectId(userId),
		createdAt: new Date()
	});
}

/**
 * Manually force a full retained sync to the device.
 * Logs a 'sync' event to device history.
 */
export async function forceSyncDevice(deviceSlug: string, userId: string): Promise<void> {
	const device = await requireOwnedDevice(deviceSlug, userId);
	const deviceId = device._id!;

	await pushRetainedSync(deviceSlug);

	await deviceHistoryCol.insertOne({
		deviceId,
		deviceSlug,
		action: 'sync',
		actorUserId: new ObjectId(userId),
		createdAt: new Date()
	});
}
