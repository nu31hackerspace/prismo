import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { devicesCol, ObjectId } from '$lib/server/db';
import {
	listOrgKeys,
	renameOrgKey,
	deleteOrgKey,
	attachKeyToDevice
} from '$lib/keys/server/key-service';
import { removeKeyFromDevice } from '$lib/devices/server/device-service';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/');

	const ownerId = new ObjectId(locals.user.id);

	const [keys, devices] = await Promise.all([
		listOrgKeys(locals.user.id),
		devicesCol.find({ ownerId }).sort({ createdAt: 1 }).toArray()
	]);

	return {
		keys,
		devices: devices.map((d) => ({ deviceSlug: d.deviceSlug, name: d.name }))
	};
};

export const actions: Actions = {
	rename: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const keyId = (data.get('keyId') as string)?.trim();
		const name = (data.get('name') as string)?.trim();
		if (!keyId || !name) return fail(400, { message: 'keyId and name are required' });
		try {
			await renameOrgKey(locals.user.id, keyId, name);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	attachDevice: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const keyId = (data.get('keyId') as string)?.trim();
		const deviceSlug = (data.get('deviceSlug') as string)?.trim();
		if (!keyId || !deviceSlug) return fail(400, { message: 'keyId and deviceSlug are required' });
		try {
			await attachKeyToDevice(locals.user.id, keyId, deviceSlug);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	detachDevice: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const keyId = (data.get('keyId') as string)?.trim();
		const deviceSlug = (data.get('deviceSlug') as string)?.trim();
		if (!keyId || !deviceSlug) return fail(400, { message: 'keyId and deviceSlug are required' });
		try {
			await removeKeyFromDevice(deviceSlug, locals.user.id, keyId);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const data = await request.formData();
		const keyId = (data.get('keyId') as string)?.trim();
		if (!keyId) return fail(400, { message: 'keyId is required' });
		try {
			await deleteOrgKey(locals.user.id, keyId);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { message: e instanceof Error ? e.message : 'Unknown error' });
		}
	}
};
