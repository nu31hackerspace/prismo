import { NextResponse, NextRequest } from 'next/server';
import { OAuth2Client } from '@/lib/server/google-auth';

export async function GET(request: NextRequest) {
	const client = new OAuth2Client(
		process.env.GOOGLE_CLIENT_ID!,
		process.env.GOOGLE_CLIENT_SECRET!,
		`${process.env.ORIGIN}/google/callback`
	);

	const authUrl = client.generateAuthUrl({
		access_type: 'online',
		scope: ['openid', 'email', 'profile']
	});

	return NextResponse.redirect(new URL(authUrl, request.url), 303);
}
