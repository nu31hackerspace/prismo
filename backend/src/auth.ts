import jwt from 'jsonwebtoken';
import { query } from './db/pg';

export const SESSION_COOKIE = 'session';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var is not set');
  return secret;
}

export async function createSession(userId: string): Promise<string> {
  return jwt.sign({ userId }, getSecret(), { expiresIn: '365d' });
}

export async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getSecret()) as { userId: string };
    const { rows } = await query(
      'SELECT id, name, email FROM "user" WHERE id = $1',
      [decoded.userId],
    );
    if (rows.length === 0) return null;
    return { id: rows[0].id, name: rows[0].name, email: rows[0].email };
  } catch {
    return null;
  }
}

export async function resolveSessionFromToken(
  token: string | undefined,
): Promise<{ userId: string } | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getSecret()) as { userId: string };
    const { rows } = await query('SELECT id FROM "user" WHERE id = $1', [
      decoded.userId,
    ]);
    if (rows.length === 0) return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}
