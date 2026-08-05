import { NextResponse, NextRequest } from 'next/server';
import { SESSION_COOKIE, invalidateSession, validateSession } from '@/lib/server/auth';
import { cookies } from 'next/headers';

async function handleLogout(request: NextRequest) {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
	
	if (sessionCookie) {
		const { user, session } = await validateSession(sessionCookie);
		if (user && session) {
			await invalidateSession(user.id, session.id);
		}
	}
	
	cookieStore.delete(SESSION_COOKIE);
	return NextResponse.redirect(new URL('/', request.url), 303);
}

export async function POST(request: NextRequest) {
	return handleLogout(request);
}

export async function GET(request: NextRequest) {
	return handleLogout(request);
}
