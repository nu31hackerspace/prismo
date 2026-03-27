import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workerJobs } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { ssid, password } = await request.json();
	if (!ssid || !password) throw error(400, 'ssid and password are required');

	const [job] = await db
		.insert(workerJobs)
		.values({
			ownerId: locals.user.id,
			inputPayload: { ssid, password }
		})
		.returning({ id: workerJobs.id });

	return json({ jobId: job.id }, { status: 201 });
};
