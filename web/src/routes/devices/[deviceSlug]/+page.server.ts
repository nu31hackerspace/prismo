import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { devicesCol, deviceKeysCol, deviceHistoryCol, ObjectId } from '$lib/server/db';
import {
	addKeyToDevice,
	removeKeyFromDevice,
	triggerDevice,
	forceSyncDevice,
	generateMqttCredentialsBySlug
} from '$lib/devices/server/device-service';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(303, '/');

	const { deviceSlug } = params;

	const device = await devicesCol.findOne({
		deviceSlug,
		ownerId: new ObjectId(locals.user.id)
	});
	if (!device) throw error(404, 'Device not found');

	const deviceId = device._id!;

	const [keys, history, lastUnauth] = await Promise.all([
		deviceKeysCol.find({ deviceId }).toArray(),
		deviceHistoryCol.find({ deviceId }).sort({ createdAt: -1 }).limit(50).toArray(),
		deviceHistoryCol.findOne(
			{ deviceId, action: 'scan', allowed: false },
			{ sort: { createdAt: -1 } }
		)
	]);

	return {
		device: {
			id: deviceId.toHexString(),
			name: device.name,
			deviceSlug: device.deviceSlug,
			lastSeenAt: device.lastSeenAt ?? null
		},
		keys: keys.map((k) => ({
			keyId: k.keyId,
			username: k.username,
			addedAt: k.addedAt
		})),
		history: history.map((h) => ({
			id: h._id!.toHexString(),
			action: h.action,
			keyId: h.keyId ?? null,
			username: h.username ?? null,
			allowed: h.allowed ?? null,
			triggerAction: h.triggerAction ?? null,
			createdAt: h.createdAt
		})),
		lastUnauth: lastUnauth ? { keyId: lastUnauth.keyId!, createdAt: lastUnauth.createdAt } : null
	};
};

export const actions: Actions = {
	addKey: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const keyId = (data.get('keyId') as string)?.trim();
		const username = (data.get('username') as string)?.trim();
		if (!keyId || !username) return fail(400, { message: 'keyId and username are required' });
		try {
			await addKeyToDevice(params.deviceSlug!, locals.user.id, keyId, username);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	removeKey: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const keyId = (data.get('keyId') as string)?.trim();
		if (!keyId) return fail(400, { message: 'keyId is required' });
		try {
			await removeKeyFromDevice(params.deviceSlug!, locals.user.id, keyId);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	createToken: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		try {
			const token = await generateMqttCredentialsBySlug(params.deviceSlug!, locals.user.id);
			return { token };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	triggerAction: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const action = data.get('action') as 'success' | 'error';
		if (action !== 'success' && action !== 'error')
			return fail(400, { message: 'action must be success or error' });
		try {
			await triggerDevice(params.deviceSlug!, locals.user.id, action);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	syncKeys: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		try {
			await forceSyncDevice(params.deviceSlug!, locals.user.id);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	}
};
