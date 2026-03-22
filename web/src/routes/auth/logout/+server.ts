import { redirect, type RequestHandler } from '@sveltejs/kit';
import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	// If there's an active session on the context, securely remove it from DB
	if (locals.user && locals.session) {
		await invalidateSession(locals.user.id, locals.session.id);
	}

	cookies.delete(SESSION_COOKIE, { path: '/' });
	throw redirect(303, '/');
};

export const GET: RequestHandler = async ({ cookies, locals }) => {
	// If there's an active session on the context, securely remove it from DB
	if (locals.user && locals.session) {
		await invalidateSession(locals.user.id, locals.session.id);
	}

	cookies.delete(SESSION_COOKIE, { path: '/' });
	throw redirect(303, '/');
};
