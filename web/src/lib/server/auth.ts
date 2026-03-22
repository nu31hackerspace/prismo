import { env } from '$env/dynamic/private';
import { createHmac } from 'crypto';

const SESSION_COOKIE = 'session';

function getSecret(): string {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET env var is not set');
	return secret;
}

function sign(payload: string): string {
	const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
	return `${payload}.${sig}`;
}

function unsign(value: string): string | null {
	const lastDot = value.lastIndexOf('.');
	if (lastDot === -1) return null;
	const payload = value.slice(0, lastDot);
	const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
	const actual = value.slice(lastDot + 1);
	// Constant-time comparison
	if (expected.length !== actual.length) return null;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
	}
	return diff === 0 ? payload : null;
}

export function createSessionValue(userId: number): string {
	return sign(String(userId));
}

export function verifySessionValue(value: string): number | null {
	const payload = unsign(value);
	if (!payload) return null;
	const id = parseInt(payload, 10);
	return isNaN(id) ? null : id;
}

export { SESSION_COOKIE };
