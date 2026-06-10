/**
 * Auth seeding — the single deliberate deviation from a pure black-box run.
 *
 * Instead of going through the real Google OAuth flow, we insert a user and a
 * session directly into Mongo, then mint the same JWT the app would (signed with
 * SESSION_SECRET) and hand it back as a cookie value. This is exactly what
 * web/src/lib/server/auth.ts:createSession + the google callback do, so the rest
 * of the app runs as the real production build with OAuth effectively disabled.
 */
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from './env';

const DAYS_365_MS = 365 * 24 * 60 * 60 * 1000;

interface Session {
	id: string;
	expiresAt: number;
}

export interface SeededAuth {
	/** Value for the `session` cookie. */
	token: string;
	userId: string;
	email: string;
}

export async function seedAuthSession(): Promise<SeededAuth> {
	const client = new MongoClient(config.mongodbUrl);
	try {
		await client.connect();
		const users = client.db(config.mongodbDatabase).collection('users');

		// Upsert the stand-in user (mirrors the google callback's findOne/insert).
		let user = await users.findOne({ googleId: config.seedUserGoogleId });
		if (!user) {
			const res = await users.insertOne({
				googleId: config.seedUserGoogleId,
				email: config.seedUserEmail,
				name: config.seedUserName,
				sessions: [],
				createdAt: new Date()
			});
			user = await users.findOne({ _id: res.insertedId });
		}
		if (!user) throw new Error('Failed to seed test-stand user');

		// Append a fresh session, pruning expired ones (matches createSession).
		const sessionId = crypto.randomUUID();
		const expiresAt = Date.now() + DAYS_365_MS;
		const existing: Session[] = (user.sessions ?? []).filter(
			(s: Session) => s.expiresAt > Date.now()
		);
		existing.push({ id: sessionId, expiresAt });
		await users.updateOne({ _id: user._id }, { $set: { sessions: existing } });

		const userId = (user._id as ObjectId).toHexString();
		const token = jwt.sign({ userId, sessionId }, config.sessionSecret, { expiresIn: '365d' });

		return { token, userId, email: config.seedUserEmail };
	} finally {
		await client.close();
	}
}
