import { db } from '$lib/server/db';
import { devices as devicesTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createDevice, generateDeviceToken } from '$lib/server/device';
import { fail, type Actions } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.user) {
		return {
			devices: []
		};
	}

	const userDevices = await db.select().from(devicesTable).where(eq(devicesTable.ownerId, locals.user.id));
	
	return {
		devices: userDevices
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
		const deviceId = parseInt(data.get('deviceId') as string);

		if (isNaN(deviceId)) {
			return fail(400, { message: 'Invalid Device ID' });
		}

		try {
			const token = await generateDeviceToken(deviceId, locals.user.id);
			return { token };
		} catch (e: any) {
			return fail(400, { message: e.message });
		}
	}
};
