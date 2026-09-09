import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { firmwareBucket, ObjectId } from '$lib/server/db';
import { Readable } from 'stream';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let fileId: ObjectId;
	try {
		fileId = new ObjectId(params.id);
	} catch {
		throw error(400, 'Invalid file ID');
	}

	const file = await firmwareBucket
		.find({ _id: fileId, 'metadata.ownerId': locals.user.id })
		.next();

	if (!file) throw error(404, 'File not found');

	const downloadStream = firmwareBucket.openDownloadStream(fileId);

	const webStream = new ReadableStream({
		start(controller) {
			downloadStream.on('data', (chunk) => controller.enqueue(chunk));
			downloadStream.on('end', () => controller.close());
			downloadStream.on('error', (err) => controller.error(err));
		},
		cancel() {
			downloadStream.destroy();
		}
	});

	return new Response(webStream, {
		headers: {
			'Content-Type': file.metadata?.contentType ?? 'application/octet-stream',
			'Content-Disposition': 'attachment; filename="prismo-firmware.bin"'
		}
	});
};
