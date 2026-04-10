import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { devicesCol, deviceHistoryCol, ObjectId } from '$lib/server/db';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { deviceSlug } = params;

	const device = await devicesCol.findOne({
		deviceSlug,
		ownerId: new ObjectId(locals.user.id)
	});
	if (!device) throw error(404, 'Device not found');

	console.log(`[sse] client connected for device "${deviceSlug}"`);

	// Stream 1: new history events
	const historyStream = deviceHistoryCol.watch(
		[{ $match: { operationType: 'insert', 'fullDocument.deviceSlug': deviceSlug } }],
		{ fullDocument: 'updateLookup' }
	);

	// Stream 2: device heartbeat updates (lastSeenAt changes)
	const statusStream = devicesCol.watch(
		[{ $match: { operationType: 'update', 'documentKey._id': device._id } }],
		{ fullDocument: 'updateLookup' }
	);

	const stream = new ReadableStream({
		start(controller) {
			historyStream.on('change', (change) => {
				if (change.operationType !== 'insert') return;
				const doc = change.fullDocument;
				console.log(`[sse] history event for "${deviceSlug}": ${doc.action}`);
				const payload = JSON.stringify({
					id: doc._id!.toHexString(),
					action: doc.action,
					keyId: doc.keyId ?? null,
					username: doc.username ?? null,
					allowed: doc.allowed ?? null,
					triggerAction: doc.triggerAction ?? null,
					createdAt: doc.createdAt
				});
				controller.enqueue(`data: ${payload}\n\n`);
			});

			statusStream.on('change', (change) => {
				if (change.operationType !== 'update') return;
				const doc = change.fullDocument;
				if (!doc?.lastSeenAt) return;
				controller.enqueue(`event: status\ndata: ${JSON.stringify({ lastSeenAt: doc.lastSeenAt })}\n\n`);
			});

			historyStream.on('error', (err) => {
				console.error(`[sse] history stream error for "${deviceSlug}":`, err);
				controller.close();
			});

			statusStream.on('error', (err) => {
				console.error(`[sse] status stream error for "${deviceSlug}":`, err);
				controller.close();
			});
		},
		cancel() {
			console.log(`[sse] client disconnected for device "${deviceSlug}"`);
			historyStream.close().catch(() => {});
			statusStream.close().catch(() => {});
		}
	});

	return new Response(stream.pipeThrough(new TextEncoderStream()), {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
