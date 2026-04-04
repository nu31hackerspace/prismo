import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workerJobs } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { ssid, password, mqttUser, mqttPass } = await request.json();
	if (!ssid || !password || !mqttUser || !mqttPass) throw error(400, 'ssid, password, mqttUser, and mqttPass are required');

	const [job] = await db
		.insert(workerJobs)
		.values({
			ownerId: locals.user.id,
			inputPayload: { ssid, password, mqttUser, mqttPass }
		})
		.returning({ id: workerJobs.id });

	return json({ jobId: job.id }, { status: 201 });
};
