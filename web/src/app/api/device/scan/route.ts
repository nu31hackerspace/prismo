import { NextResponse, NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
	try {
		const payload = await request.json();
		console.log('--- Device Scan Received ---');
		console.log(JSON.stringify(payload, null, 2));
		console.log('---------------------------');

		return NextResponse.json({ status: 'ok' });
	} catch (e) {
		console.error('Failed to parse scan payload:', e);
		return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
	}
}
