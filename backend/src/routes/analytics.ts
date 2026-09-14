import { Router } from 'express';
import { getUserFromToken, SESSION_COOKIE } from '@/auth';
import { recordAnalyticsEvent } from '@/analytics/analytics-service';
import type { DeviceSessionRequest } from '@/middleware/device-session';

export const analyticsRouter = Router();

analyticsRouter.post('/', async (req, res) => {
  const { event, payload } = req.body ?? {};
  if (!event || typeof event !== 'string') {
    res.status(400).json({ error: 'Missing event' });
    return;
  }

  res.status(202).json({ success: true });

  const { deviceSessionId } = req as DeviceSessionRequest;
  const user = await getUserFromToken(req.cookies?.[SESSION_COOKIE]);

  try {
    await recordAnalyticsEvent(event, payload, deviceSessionId, user?.id ?? null);
  } catch (error) {
    console.error('Failed to record analytics event:', error);
  }
});
