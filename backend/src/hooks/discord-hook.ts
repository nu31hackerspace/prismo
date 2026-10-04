import type { DeviceActivity, UUID } from '@prismo/shared/entities';
import { pool } from '@/db/pg';
import { onEntityChange } from '@/db/hooks';

const DISCORD_HOSTS = ['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com'];

export function isDiscordWebhookUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && DISCORD_HOSTS.includes(url.hostname) && url.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
}

export function registerDiscordHooks(): void {
  onEntityChange((change) => {
    if (change.op !== 'upsert' || change.entity !== 'deviceActivity') return;
    notifyDoorOpened(change.workspaceId, change.data).catch((err) =>
      console.error(`[discord-hook] notify failed for activity "${change.id}":`, err),
    );
  });
}

async function notifyDoorOpened(workspaceId: UUID, activity: DeviceActivity): Promise<void> {
  const opened = (activity.kind === 'scan' && activity.allowed) || activity.kind === 'trigger';
  if (!opened) return;

  const { rows: hooks } = await pool.query<{ url: string; deviceName: string; keyLabel: string | null }>(
    `SELECT h.data->>'url' AS url, d.data->>'name' AS "deviceName", k.data->>'label' AS "keyLabel"
     FROM entities h
     JOIN entities d ON d.id = $2 AND d.type = 'device'
     LEFT JOIN entities k ON k.id = $3 AND k.type = 'key'
     WHERE h.workspace_id = $1 AND h.type = 'hook' AND h.deleted = false
       AND h.data->>'kind' = 'discord' AND h.data->>'deviceId' = $2::text`,
    [workspaceId, activity.deviceId, activity.keyId],
  );

  for (const hook of hooks) {
    if (!isDiscordWebhookUrl(hook.url)) {
      console.warn(`[discord-hook] skipping non-Discord webhook url in workspace "${workspaceId}"`);
      continue;
    }
    const who = activity.kind === 'trigger'
      ? `from the dashboard (${activity.triggerAction})`
      : `by ${hook.keyLabel ?? activity.uidHash}`;
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `🚪 **${hook.deviceName}** opened ${who}`, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) console.error(`[discord-hook] Discord responded ${res.status}: ${await res.text()}`);
  }
}
