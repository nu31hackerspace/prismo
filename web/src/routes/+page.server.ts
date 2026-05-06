import { devicesCol, ObjectId } from '$lib/server/db';
import { createDevice } from '$lib/devices/server/device-service';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { devices: [] };
	}

	const userDevices = await devicesCol.find({ ownerId: new ObjectId(locals.user.id) }).toArray();

	return {
		devices: userDevices.map(({ _id, ownerId, name, deviceSlug, createdAt, lastSeenAt }) => ({
			id: _id!.toHexString(),
			ownerId: ownerId.toHexString(),
			name,
			deviceSlug,
			createdAt,
			lastSeenAt: lastSeenAt ?? null
		}))
	};
};

export const actions: Actions = {
	addDevice: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const name = data.get('name') as string;
		const modeRaw = data.get('mode') as string;
		const mode = modeRaw === 'machine' ? 'machine' : 'door';

		if (!name) {
			return fail(400, { message: 'Name is required' });
		}

		await createDevice(locals.user.id, name, mode);
		return { success: true };
	}
};
