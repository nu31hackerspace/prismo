import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { workerJobsCol, ObjectId } from '$lib/server/db';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let jobId: ObjectId;
	try {
		jobId = new ObjectId(params.id);
	} catch {
		throw error(400, 'Invalid job ID');
	}

	const job = await workerJobsCol.findOne(
		{ _id: jobId, ownerId: new ObjectId(locals.user.id) },
		{ projection: { status: 1, outputPayload: 1 } }
	);

	if (!job) throw error(404, 'Job not found');

	return json({
		id: job._id!.toHexString(),
		status: job.status,
		outputPayload: job.outputPayload
	});
};
