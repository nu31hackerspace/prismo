import { NextResponse, NextRequest } from 'next/server';
import { workerJobsCol, ObjectId } from '@/lib/server/db';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, validateSession } from '@/lib/server/auth';

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } | Promise<{ id: string }> }
) {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
	let user = null;
	if (sessionCookie) {
		const result = await validateSession(sessionCookie);
		user = result.user;
	}
	
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const resolvedParams = await params;
	let jobId: ObjectId;
	try {
		jobId = new ObjectId(resolvedParams.id);
	} catch {
		return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
	}

	const job = await workerJobsCol.findOne(
		{ _id: jobId, ownerId: new ObjectId(user.id) },
		{ projection: { status: 1, outputPayload: 1 } }
	);

	if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

	return NextResponse.json({
		id: job._id!.toHexString(),
		status: job.status,
		outputPayload: job.outputPayload
	});
}
