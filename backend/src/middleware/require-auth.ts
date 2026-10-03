import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken, SESSION_COOKIE } from '../auth';
import { resolveWorkspace } from '../workspace-service';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    workspaceId?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const workspaceId = await resolveWorkspace(user.id, req.header('x-workspace'));
  if (!workspaceId) {
    res.status(403).json({ error: 'No workspace' });
    return;
  }
  req.user = user;
  req.workspaceId = workspaceId;
  next();
}

export function authContext(req: Request): { user: AuthUser; workspaceId: string } {
  const { user, workspaceId } = req;
  if (!user || !workspaceId) throw new Error('authContext used on a route without requireAuth');
  return { user, workspaceId };
}
