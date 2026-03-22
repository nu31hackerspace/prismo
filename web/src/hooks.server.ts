import type { Handle } from '@sveltejs/kit';
import { verifySessionValue, SESSION_COOKIE } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
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
		const userId = verifySessionValue(sessionCookie);
		if (userId !== null) {
			const [user] = await db
				.select({
					id: users.id,
					name: users.name,
					email: users.email,
					avatarUrl: users.avatarUrl
				})
				.from(users)
				.where(eq(users.id, userId))
				.limit(1);
			if (user) {
				event.locals.user = user;
			}
		}
	}

	const response = await resolve(event);
	return response;
};
