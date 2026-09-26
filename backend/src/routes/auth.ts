import { Router } from 'express';
import { createSession, getUserFromToken, SESSION_COOKIE } from '@/auth';
import { ensureUserAndMembership, getWorkspaceForUser } from '@/workspace-service';

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  error_description?: string;
}

export const authRouter = Router();

authRouter.post('/google', async (req, res) => {
  try {
    const { googleAccessToken } = req.body ?? {};
    if (!googleAccessToken) {
      res.status(400).json({ error: 'Missing googleAccessToken' });
      return;
    }

    const url = new URL('https://www.googleapis.com/oauth2/v3/userinfo');
    url.searchParams.append('access_token', googleAccessToken);
    const userInfoResponse = await fetch(url.toString());
    const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!userInfoResponse.ok) {
      res.status(401).json({ error: userInfo.error_description || 'Invalid access token' });
      return;
    }

    const { sub: googleId, email, name } = userInfo;
    if (!googleId || !email || !name) {
      res.status(400).json({ error: 'Incomplete user profile from Google' });
      return;
    }

    const userId = await ensureUserAndMembership(googleId, email, name);
    const token = await createSession(userId);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.redirect('/');
});

authRouter.get('/me', async (req, res) => {
  const user = await getUserFromToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user, workspaceId: await getWorkspaceForUser(user.id) });
});

