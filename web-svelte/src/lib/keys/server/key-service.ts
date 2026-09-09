import { devicesCol, deviceKeysCol, keysCol, ObjectId } from '$lib/server/db';
import { addKeyToDevice, removeKeyFromDevice } from '$lib/devices/server/device-service';

export interface OrgKeyWithDevices {
	keyId: string;
	name: string;
	createdAt: Date;
	devices: { deviceSlug: string; name: string }[];
}

export async function listOrgKeys(userId: string): Promise<OrgKeyWithDevices[]> {
	const ownerId = new ObjectId(userId);

	const [orgKeys, ownedDevices] = await Promise.all([
		keysCol.find({ ownerId }).sort({ createdAt: 1 }).toArray(),
		devicesCol.find({ ownerId }).toArray()
	]);

	if (orgKeys.length === 0) return [];

	const deviceById = new Map(ownedDevices.map((d) => [d._id!.toHexString(), d]));
	const deviceIds = ownedDevices.map((d) => d._id!);

	const links = await deviceKeysCol
		.find({
			deviceId: { $in: deviceIds },
			keyId: { $in: orgKeys.map((k) => k.keyId) }
		})
		.toArray();

	const devicesByKeyId = new Map<string, { deviceSlug: string; name: string }[]>();
	for (const link of links) {
		const device = deviceById.get(link.deviceId.toHexString());
		if (!device) continue;
		const list = devicesByKeyId.get(link.keyId) ?? [];
		list.push({ deviceSlug: device.deviceSlug, name: device.name });
		devicesByKeyId.set(link.keyId, list);
	}

	return orgKeys.map((k) => ({
		keyId: k.keyId,
		name: k.name,
		createdAt: k.createdAt,
		devices: devicesByKeyId.get(k.keyId) ?? []
	}));
}

export async function deleteOrgKey(userId: string, keyId: string): Promise<void> {
	const ownerId = new ObjectId(userId);

	const orgKey = await keysCol.findOne({ ownerId, keyId });
	if (!orgKey) throw new Error('Key not found');

	const ownedDevices = await devicesCol.find({ ownerId }).toArray();
	const ownedById = new Map(ownedDevices.map((d) => [d._id!.toHexString(), d]));

	const links = await deviceKeysCol
		.find({ keyId, deviceId: { $in: ownedDevices.map((d) => d._id!) } })
		.toArray();

	for (const link of links) {
		const device = ownedById.get(link.deviceId.toHexString());
		if (!device) continue;
		try {
			await removeKeyFromDevice(device.deviceSlug, userId, keyId);
		} catch (err) {
			console.error(`[key-service] removeKeyFromDevice failed for "${device.deviceSlug}":`, err);
		}
	}

	await keysCol.deleteOne({ ownerId, keyId });
}

export async function attachKeyToDevice(
	userId: string,
	keyId: string,
	deviceSlug: string
): Promise<void> {
	const ownerId = new ObjectId(userId);
	const orgKey = await keysCol.findOne({ ownerId, keyId });
	if (!orgKey) throw new Error('Key not found');

	await addKeyToDevice(deviceSlug, userId, keyId);
}
