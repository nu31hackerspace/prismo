import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';
import { env } from '$env/dynamic/private';
import { usersCol } from '$lib/server/db';
import { SESSION_COOKIE, createSession } from '$lib/server/auth';

async function loginWithPayload(
	payload: { sub?: string; email?: string; name?: string },
	cookies: import('@sveltejs/kit').Cookies
): Promise<never> {
	if (!payload.sub || !payload.email) {
		throw error(400, 'Incomplete Google profile data');
	}

	const googleId = payload.sub;
	const email = payload.email;
	const name = payload.name || email.split('@')[0];

	let user = await usersCol.findOne({ googleId });

	if (!user) {
		const result = await usersCol.insertOne({
			googleId,
			email,
			name,
			sessions: [],
			createdAt: new Date()
		});
		user = await usersCol.findOne({ _id: result.insertedId });
	}

	if (!user) throw error(500, 'Failed to log in or create user');

	const sessionToken = await createSession(user._id!.toHexString());

	cookies.set(SESSION_COOKIE, sessionToken, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 365 * 24 * 60 * 60
	});

	throw redirect(303, '/');
}

// OAuth2 code flow (from /auth/google redirect)
export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	if (!code) throw error(400, 'Missing code');

	const client = new OAuth2Client(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		`${env.ORIGIN}/google/callback`
	);

	let idToken: string;
	try {
		const { tokens } = await client.getToken(code);
		if (!tokens.id_token) throw new Error('No id_token in response');
		idToken = tokens.id_token;
	} catch (e) {
		console.error('Error exchanging Google code:', e);
		throw error(401, 'Failed to exchange authorization code');
	}

	let googlePayload;
	try {
		const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
		googlePayload = ticket.getPayload();
	} catch (e) {
		console.error('Error verifying Google ID token:', e);
		throw error(401, 'Invalid Google ID token');
	}

	return await loginWithPayload(googlePayload ?? {}, cookies);
};

// Sign In With Google button (GIS credential POST)
export const POST: RequestHandler = async ({ request, cookies }) => {
	const formData = await request.formData();
	const credential = formData.get('credential');

	if (!credential || typeof credential !== 'string') {
		throw error(400, 'Missing or invalid credential');
	}

	const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
	let googlePayload;
	try {
		const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
		googlePayload = ticket.getPayload();
	} catch (e) {
		console.error('Error verifying Google ID token:', e);
		throw error(401, 'Invalid Google ID token');
	}

	return await loginWithPayload(googlePayload ?? {}, cookies);
};
