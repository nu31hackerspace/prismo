import { query } from '@/db/pg';

export async function recordAnalyticsEvent(
  action: string,
  data: Record<string, unknown> = {},
  deviceSession: string,
  userUuid: string | null,
) {
  await query(
    'INSERT INTO analytics_event (user_uuid, device_session, action, data) VALUES ($1, $2, $3, $4)',
    [userUuid, deviceSession, action, data],
  );
}
