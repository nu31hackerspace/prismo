import { json } from '@sveltejs/kit';
import { usersCol } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export async function GET() {
	try {
		await usersCol.findOne({}, { projection: { _id: 1 } });
		return json({ status: 'ok', database: 'connected', commit: env.COMMIT_SHA }, { status: 200 });
	} catch (error) {
		console.error('Healthcheck failed to connect to database:', error);
		return json({ status: 'error', database: 'disconnected', commit: env.COMMIT_SHA }, { status: 500 });
	}
}
