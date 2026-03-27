import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await request.json();
		console.log('--- Device Scan Received ---');
		console.log(JSON.stringify(payload, null, 2));
		console.log('---------------------------');
		
		return json({ status: 'ok' });
	} catch (e) {
		console.error('Failed to parse scan payload:', e);
		return json({ error: 'Invalid payload' }, { status: 400 });
	}
};
