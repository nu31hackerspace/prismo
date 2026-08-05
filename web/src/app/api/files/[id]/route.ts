import { NextResponse, NextRequest } from 'next/server';
import { firmwareBucket, ObjectId } from '@/lib/server/db';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, validateSession } from '@/lib/server/auth';

export async function GET(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
	let user = null;
	if (sessionCookie) {
		const result = await validateSession(sessionCookie);
		user = result.user;
	}
	
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const resolvedParams = await params;
	const id = resolvedParams.id;

	let fileId: ObjectId;
	try {
		fileId = new ObjectId(id);
	} catch {
		return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
	}

	const file = await firmwareBucket
		.find({ _id: fileId, 'metadata.ownerId': user.id })
		.next();

	if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

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

	return new NextResponse(webStream, {
		headers: {
			'Content-Type': file.metadata?.contentType ?? 'application/octet-stream',
			'Content-Disposition': 'attachment; filename="prismo-firmware.bin"'
		}
	});
}
