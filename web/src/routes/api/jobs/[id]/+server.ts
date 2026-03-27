import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workerJobs } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const [job] = await db
		.select({
			id: workerJobs.id,
			status: workerJobs.status,
			outputPayload: workerJobs.outputPayload
		})
		.from(workerJobs)
		.where(and(eq(workerJobs.id, Number(params.id)), eq(workerJobs.ownerId, locals.user.id)));

	if (!job) throw error(404, 'Job not found');

	return json(job);
};
