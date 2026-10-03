import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export const DEVICE_SESSION_COOKIE = 'device-session';

export interface DeviceSessionRequest extends Request {
  deviceSessionId: string;
}

export function deviceSession(req: Request, res: Response, next: NextFunction) {
  let deviceSessionId = req.cookies?.[DEVICE_SESSION_COOKIE];
  if (!deviceSessionId) {
    deviceSessionId = randomUUID();
    res.cookie(DEVICE_SESSION_COOKIE, deviceSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
  (req as DeviceSessionRequest).deviceSessionId = deviceSessionId;
  next();
}
