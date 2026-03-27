import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const [file] = await db
		.select()
		.from(files)
		.where(and(eq(files.id, Number(params.id)), eq(files.ownerId, locals.user.id)));

	if (!file) throw error(404, 'File not found');

	return new Response(file.content, {
		headers: {
			'Content-Type': file.contentType,
			'Content-Disposition': 'attachment; filename="prismo-firmware.bin"'
		}
	});
};
