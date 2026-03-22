import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE, createSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const formData = await request.formData();
	const credential = formData.get('credential');

	if (!credential || typeof credential !== 'string') {
		throw error(400, 'Missing or invalid credential');
	}

	const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
	let payload;

	try {
		const ticket = await client.verifyIdToken({
			idToken: credential,
			audience: env.GOOGLE_CLIENT_ID
		});
		payload = ticket.getPayload();
	} catch (e) {
		console.error('Error verifying Google ID token:', e);
		throw error(401, 'Invalid Google ID token');
	}

	if (!payload || !payload.sub || !payload.email) {
		throw error(400, 'Incomplete Google profile data');
	}

	const googleId = payload.sub;
	const email = payload.email;
	const name = payload.name || email.split('@')[0];
	const avatarUrl = payload.picture || null;

	let user = undefined;

	// 1. Try to find by googleId
	const [existingByGoogleId] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
	if (existingByGoogleId) {
		user = existingByGoogleId;
	} else {
		// 2. Try to find by email
		const [existingByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
		if (existingByEmail) {
			// Link the google account
			const [updatedUser] = await db
				.update(users)
				.set({ googleId, avatarUrl: existingByEmail.avatarUrl || avatarUrl })
				.where(eq(users.id, existingByEmail.id))
				.returning();
			user = updatedUser;
		} else {
			// 3. Create new user
			const [newUser] = await db
				.insert(users)
				.values({
					googleId,
					email,
					name,
					avatarUrl
				})
				.returning();
			user = newUser;
		}
	}

	if (!user) {
		throw error(500, 'Failed to log in or create user');
	}

	// Create DB session instead of HMAC
	const sessionId = await createSession(user.id);

	cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 365 * 24 * 60 * 60 // 365 days in seconds
	});

	throw redirect(303, '/');
};
