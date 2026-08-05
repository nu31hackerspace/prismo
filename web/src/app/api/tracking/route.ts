import { NextResponse, NextRequest } from 'next/server';
import { trackingCol } from '@/lib/server/db';
import { cookies } from 'next/headers';

const COUNTRY_HEADER_NAME = 'cf-ipcountry';

export async function POST(request: NextRequest) {
	const cookieStore = await cookies();
	let deviceUuid = cookieStore.get('device-uuid')?.value;

	if (!deviceUuid) {
		return NextResponse.json({ success: false, error: 'No device UUID found' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { event, context, payload } = body;
		const country = request.headers.get(COUNTRY_HEADER_NAME);

		if (!event) {
			return NextResponse.json({ success: false, error: 'Event name is required' }, { status: 400 });
		}

		await trackingCol.insertOne({
			deviceUuid,
			event,
			context: context || null,
			country: country || null,
			payload: payload || null,
			createdAt: new Date()
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to log tracking event:', error);
		return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
}
