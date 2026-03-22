import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

const SESSION_COOKIE = 'session';
const DAYS_365_MS = 365 * 24 * 60 * 60 * 1000;

export interface UserSession {
	id: string;
	expiresAt: number;
}

function getSecret(): string {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET env var is not set');
	return secret;
}

export async function createSession(userId: number): Promise<string> {
	const sessionId = crypto.randomUUID();
	const expiresAt = Date.now() + DAYS_365_MS;

	const newSessionObj: UserSession = { id: sessionId, expiresAt };

	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user) throw new Error('User not found');

	const currentSessions: UserSession[] = Array.isArray(user.sessions) 
		? (user.sessions as UserSession[]) 
		: [];

	// Filter out expired sessions and add new one
	const validSessions = currentSessions.filter(s => s.expiresAt > Date.now());
	validSessions.push(newSessionObj);

	await db.update(users).set({ sessions: validSessions }).where(eq(users.id, userId));

	// Create and sign JWT
	const token = jwt.sign(
		{ userId, sessionId },
		getSecret(),
		{ expiresIn: '365d' }
	);

	return token;
}

export async function validateSession(token: string) {
	try {
		const decoded = jwt.verify(token, getSecret()) as { userId: number; sessionId: string };
		const { userId, sessionId } = decoded;

		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user) return { user: null, session: null };

		const currentSessions = Array.isArray(user.sessions) ? (user.sessions as UserSession[]) : [];
		
		const activeSession = currentSessions.find(s => s.id === sessionId && s.expiresAt > Date.now());

		if (!activeSession) {
			return { user: null, session: null };
		}

		return { user, session: activeSession };

	} catch (e) {
		// Token is invalid, expired, or malformed
		return { user: null, session: null };
	}
}

export async function invalidateSession(userId: number, sessionId: string): Promise<void> {
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user) return;

	const currentSessions = Array.isArray(user.sessions) ? (user.sessions as UserSession[]) : [];
	const updatedSessions = currentSessions.filter(s => s.id !== sessionId);

	await db.update(users).set({ sessions: updatedSessions }).where(eq(users.id, userId));
}

export { SESSION_COOKIE };
