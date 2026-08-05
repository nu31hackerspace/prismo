import { cookies } from 'next/headers';
import { validateSession, SESSION_COOKIE } from './auth';

export async function getUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie) return null;

  const { user, session } = await validateSession(sessionCookie.value);

  if (user && session) {
    return user;
  }
  
  return null;
}
