import { NextResponse, NextRequest } from 'next/server';
import { workerJobsCol, devicesCol, ObjectId } from '@/lib/server/db';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, validateSession } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
	let user = null;
	if (sessionCookie) {
		const result = await validateSession(sessionCookie);
		user = result.user;
	}
	
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { ssid, password, mqttUser, mqttPass, mode } = await request.json();
	if (!ssid || !password || !mqttUser || !mqttPass) {
		return NextResponse.json({ error: 'ssid, password, mqttUser, and mqttPass are required' }, { status: 400 });
	}

	const deviceMode: 'door' | 'machine' = mode === 'machine' ? 'machine' : 'door';

	const result = await workerJobsCol.insertOne({
		ownerId: new ObjectId(user.id),
		status: 'pending',
		attemptCount: 0,
		maxAttemptCount: 3,
		inputPayload: {
			ssid,
			password,
			mqttUser,
			mqttPass,
			mode: deviceMode,
			commitSha: process.env.COMMIT_SHA ?? 'unknown'
		},
		createdAt: new Date(),
		updatedAt: new Date()
	});

	await devicesCol.updateOne(
		{ deviceSlug: mqttUser, ownerId: new ObjectId(user.id) },
		{ $set: { mode: deviceMode, modeParams: {} } }
	);

	return NextResponse.json({ jobId: result.insertedId.toHexString() }, { status: 201 });
}
