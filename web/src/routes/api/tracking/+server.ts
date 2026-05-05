import { json } from '@sveltejs/kit';
import { trackingCol } from '$lib/server/db';
import type { RequestHandler } from './$types';

const COUNTRY_HEADER_NAME = 'cf-ipcountry';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	let deviceUuid = locals.deviceUuid;

	// Fallback if not set in locals
	if (!deviceUuid) {
		deviceUuid = cookies.get('device-uuid');
	}

	if (!deviceUuid) {
		return json({ success: false, error: 'No device UUID found' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { event, context, payload } = body;
		const country = request.headers.get(COUNTRY_HEADER_NAME);

		if (!event) {
			return json({ success: false, error: 'Event name is required' }, { status: 400 });
		}

		await trackingCol.insertOne({
			deviceUuid,
			event,
			context: context || null,
			country: country || null,
			payload: payload || null,
			createdAt: new Date()
		});

		return json({ success: true });
	} catch (error) {
		console.error('Failed to log tracking event:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
