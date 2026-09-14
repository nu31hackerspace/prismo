import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken, SESSION_COOKIE } from '../auth';
import { getWorkspaceForUser } from '../workspace-service';

export interface AuthedRequest extends Request {
  user: { id: string; name: string; email: string };
  workspaceId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const workspaceId = await getWorkspaceForUser(user.id);
  if (!workspaceId) {
    res.status(403).json({ error: 'No workspace' });
    return;
  }
  (req as AuthedRequest).user = user;
  (req as AuthedRequest).workspaceId = workspaceId;
  next();
}
