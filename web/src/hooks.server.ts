import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	let deviceUuid = event.cookies.get('device-uuid');

	console.log('ntuoaentuh', deviceUuid);

	if (!deviceUuid) {
		deviceUuid = crypto.randomUUID();
		event.cookies.set('device-uuid', deviceUuid, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365 * 10 // 10 years
		});
	}

	event.locals.deviceUuid = deviceUuid;

	const response = await resolve(event);
	return response;
};
