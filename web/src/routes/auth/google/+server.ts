import { redirect, type RequestHandler } from '@sveltejs/kit';
import { OAuth2Client } from '$lib/server/google-auth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const client = new OAuth2Client(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		`${env.ORIGIN}/google/callback`
	);

	const authUrl = client.generateAuthUrl({
		access_type: 'online',
		scope: ['openid', 'email', 'profile']
	});

	throw redirect(303, authUrl);
};
