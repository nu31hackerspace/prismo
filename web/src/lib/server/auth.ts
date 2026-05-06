import { usersCol, ObjectId } from './db';
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

export async function createSession(userId: string): Promise<string> {
	const sessionId = crypto.randomUUID();
	const expiresAt = Date.now() + DAYS_365_MS;

	const newSession: UserSession = { id: sessionId, expiresAt };

	const user = await usersCol.findOne({ _id: new ObjectId(userId) });
	if (!user) throw new Error('User not found');

	const validSessions = (user.sessions ?? []).filter((s) => s.expiresAt > Date.now());
	validSessions.push(newSession);

	await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { sessions: validSessions } });

	const token = jwt.sign({ userId, sessionId }, getSecret(), { expiresIn: '365d' });

	return token;
}

export async function validateSession(token: string) {
	try {
		const decoded = jwt.verify(token, getSecret()) as { userId: string; sessionId: string };
		const { userId, sessionId } = decoded;

		const user = await usersCol.findOne({ _id: new ObjectId(userId) });
		if (!user) return { user: null, session: null };

		const activeSession = (user.sessions ?? []).find(
			(s) => s.id === sessionId && s.expiresAt > Date.now()
		);

		if (!activeSession) return { user: null, session: null };

		return {
			user: { id: user._id!.toHexString(), name: user.name, email: user.email },
			session: activeSession
		};
	} catch {
		return { user: null, session: null };
	}
}

export async function invalidateSession(userId: string, sessionId: string): Promise<void> {
	await usersCol.updateOne(
		{ _id: new ObjectId(userId) },
		{ $pull: { sessions: { id: sessionId } as any } }
	);
}

export { SESSION_COOKIE };
