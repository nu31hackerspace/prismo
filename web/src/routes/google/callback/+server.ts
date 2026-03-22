import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OAuth2Client } from 'google-auth-library';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSessionValue, SESSION_COOKIE } from '$lib/server/auth';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const POST: RequestHandler = async ({ request, cookies }) => {
	const formData = await request.formData();
	const credential = formData.get('credential');

	if (!credential || typeof credential !== 'string') {
		return json({ error: 'Missing credential' }, { status: 400 });
	}

	// Verify the Google ID token
	let payload;
	try {
		const ticket = await client.verifyIdToken({
			idToken: credential,
			audience: env.GOOGLE_CLIENT_ID
		});
		payload = ticket.getPayload();
	} catch {
		return json({ error: 'Invalid token' }, { status: 401 });
	}

	if (!payload || !payload.sub || !payload.email) {
		return json({ error: 'Invalid token payload' }, { status: 401 });
	}

	const { sub: googleId, email, name, picture } = payload;

	// Upsert user: find by googleId first, then email, then create
	let user = await db.query.users.findFirst({ where: eq(users.googleId, googleId) });

	if (!user) {
		// Try to find by email (link existing account)
		const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
		if (existing) {
			// Link the Google ID to the existing account
			await db
				.update(users)
				.set({ googleId, avatarUrl: picture ?? existing.avatarUrl })
				.where(eq(users.id, existing.id));
			user = { ...existing, googleId, avatarUrl: picture ?? existing.avatarUrl };
		} else {
			// Create a new user
			const [newUser] = await db
				.insert(users)
				.values({
					googleId,
					email,
					name: name ?? email,
					avatarUrl: picture ?? null
				})
				.returning();
			user = newUser;
		}
	} else if (picture && user.avatarUrl !== picture) {
		// Keep avatar URL fresh
		await db.update(users).set({ avatarUrl: picture }).where(eq(users.id, user.id));
	}

	// Set the session cookie
	cookies.set(SESSION_COOKIE, createSessionValue(user.id), {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});

	redirect(303, '/');
};
