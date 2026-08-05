import { NextRequest } from 'next/server';
import { devicesCol, deviceHistoryCol, ObjectId } from '@/lib/server/db';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, validateSession } from '@/lib/server/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { deviceSlug: string } | Promise<{ deviceSlug: string }> }
) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  let user = null;
  if (sessionCookie) {
    const result = await validateSession(sessionCookie);
    user = result.user;
  }
  
  if (!user) return new Response('Unauthorized', { status: 401 });

  const resolvedParams = await params;
  const deviceSlug = resolvedParams.deviceSlug;

  const device = await devicesCol.findOne({
    deviceSlug,
    ownerId: new ObjectId(user.id)
  });
  
  if (!device) return new Response('Device not found', { status: 404 });

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
        if (!doc) return;
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
        if (!doc) return;
        controller.enqueue(
          `event: status\ndata: ${JSON.stringify({ lastSeenAt: doc.lastSeenAt, modeParams: doc.modeParams ?? {} })}\n\n`
        );
      });

      historyStream.on('error', (err) => {
        console.error(`[sse] history stream error for "${deviceSlug}":`, err);
        controller.close();
      });

      statusStream.on('error', (err) => {
        console.error(`[sse] status stream error for "${deviceSlug}":`, err);
        controller.close();
      });
      
      // Keep alive heartbeat every 30s so the connection isn't dropped by some proxies
      const interval = setInterval(() => {
        controller.enqueue(':\n\n');
      }, 30000);

      // Clean up interval when stream is closed internally
      request.signal.addEventListener('abort', () => clearInterval(interval));
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
      'Connection': 'keep-alive',
      // Ensure Next.js doesn't buffer the stream
      'X-Accel-Buffering': 'no'
    }
  });
}
