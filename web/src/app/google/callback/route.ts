import { NextResponse, NextRequest } from 'next/server';
import { OAuth2Client } from '@/lib/server/google-auth';
import { usersCol } from '@/lib/server/db';
import { SESSION_COOKIE, createSession } from '@/lib/server/auth';
import { cookies } from 'next/headers';

async function loginWithPayload(
	payload: { sub?: string; email?: string; name?: string },
	reqUrl: string
) {
	if (!payload.sub || !payload.email) {
		return NextResponse.json({ error: 'Incomplete Google profile data' }, { status: 400 });
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

	if (!user) {
		return NextResponse.json({ error: 'Failed to log in or create user' }, { status: 500 });
	}

	const sessionToken = await createSession(user._id!.toHexString());

	const cookieStore = await cookies();
	cookieStore.set(SESSION_COOKIE, sessionToken, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 365 * 24 * 60 * 60
	});

	return NextResponse.redirect(new URL('/devices', reqUrl), 303);
}

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get('code');
	if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

	const client = new OAuth2Client(
		process.env.GOOGLE_CLIENT_ID!,
		process.env.GOOGLE_CLIENT_SECRET!,
		`${process.env.ORIGIN}/google/callback`
	);

	let idToken: string;
	try {
		const { tokens } = await client.getToken(code);
		if (!tokens.id_token) throw new Error('No id_token in response');
		idToken = tokens.id_token;
	} catch (e) {
		console.error('Error exchanging Google code:', e);
		return NextResponse.json({ error: 'Failed to exchange authorization code' }, { status: 401 });
	}

	let googlePayload;
	try {
		const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID! });
		googlePayload = ticket.getPayload();
	} catch (e) {
		console.error('Error verifying Google ID token:', e);
		return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
	}

	return loginWithPayload(googlePayload ?? {}, request.url);
}

export async function POST(request: NextRequest) {
	const formData = await request.formData();
	const credential = formData.get('credential');

	if (!credential || typeof credential !== 'string') {
		return NextResponse.json({ error: 'Missing or invalid credential' }, { status: 400 });
	}

	const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);
	let googlePayload;
	try {
		const ticket = await client.verifyIdToken({
			idToken: credential,
			audience: process.env.GOOGLE_CLIENT_ID!
		});
		googlePayload = ticket.getPayload();
	} catch (e) {
		console.error('Error verifying Google ID token:', e);
		return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
	}

	return loginWithPayload(googlePayload ?? {}, request.url);
}
