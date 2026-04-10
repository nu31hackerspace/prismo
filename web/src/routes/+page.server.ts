import { devicesCol, ObjectId } from '$lib/server/db';
import { createDevice, generateMqttCredentials } from '$lib/devices/server/device-service';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { devices: [] };
	}

	const userDevices = await devicesCol
		.find({ ownerId: new ObjectId(locals.user.id) })
		.toArray();

	return {
		devices: userDevices.map(({ _id, ownerId, name, deviceSlug, tokenKey, createdAt }) => ({
			id: _id!.toHexString(),
			ownerId: ownerId.toHexString(),
			name,
			deviceSlug,
			tokenKey,
			createdAt
		}))
	};
};

export const actions: Actions = {
	addDevice: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const name = data.get('name') as string;

		if (!name) {
			return fail(400, { message: 'Name is required' });
		}

		await createDevice(locals.user.id, name);
		return { success: true };
	},

	createToken: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const deviceId = data.get('deviceId') as string;

		if (!deviceId) {
			return fail(400, { message: 'Invalid Device ID' });
		}

		try {
			const token = await generateMqttCredentials(deviceId, locals.user.id);
			return { token };
		} catch (e: any) {
			return fail(400, { message: e.message });
		}
	}
};
