import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { workerJobsCol, ObjectId } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { ssid, password, mqttUser, mqttPass } = await request.json();
	if (!ssid || !password || !mqttUser || !mqttPass) throw error(400, 'ssid, password, mqttUser, and mqttPass are required');

	const result = await workerJobsCol.insertOne({
		ownerId: new ObjectId(locals.user.id),
		status: 'pending',
		attemptCount: 0,
		maxAttemptCount: 3,
		inputPayload: { ssid, password, mqttUser, mqttPass },
		createdAt: new Date(),
		updatedAt: new Date()
	});

	return json({ jobId: result.insertedId.toHexString() }, { status: 201 });
};
