import { error, type Handle } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE } from '$lib/server/auth';
import { initializeScanListener } from '$lib/devices/server/scan-listener';

initializeScanListener();

export const handle: Handle = async ({ event, resolve }) => {
	// --- CSRF Protection ---
	if (event.request.method === 'POST' || event.request.method === 'PUT' || event.request.method === 'PATCH' || event.request.method === 'DELETE') {
		if (!event.url.pathname.startsWith('/google/callback')) {
			const origin = event.request.headers.get('origin') || event.request.headers.get('referer');
			if (origin && !origin.startsWith(event.url.origin)) {
				throw error(403, 'Cross-site POST form submissions are forbidden');
			}
		}
	}

	// --- Device UUID (existing tracking) ---
	let deviceUuid = event.cookies.get('device-uuid');

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

	// --- Session / User ---
	const sessionCookie = event.cookies.get(SESSION_COOKIE);
	if (sessionCookie) {
		const { user, session } = await validateSession(sessionCookie);
		
		if (user && session) {
			event.locals.user = user;
			event.locals.session = session;
		} else {
			// Invalid or expired session: clear the cookie
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	const response = await resolve(event);
	return response;
};
