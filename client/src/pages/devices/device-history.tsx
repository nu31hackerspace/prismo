import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { formatDate } from "@/lib/utils";
import { listClass, Panel } from "./panel";

import type { DeviceActivity } from "@/store/models";

const actionLabels: Record<string, string> = {
  scan: 'Scan',
  trigger: 'Trigger',
  key_added: 'Key Added',
  key_removed: 'Key Removed',
  sync: 'Keys Synced'
};
const actionIcons: Record<string, string> = {
  scan: 'mdi:nfc-variant',
  trigger: 'mdi:lightning-bolt',
  key_added: 'mdi:key-plus',
  key_removed: 'mdi:key-remove',
  sync: 'mdi:sync'
};

function badge(event: DeviceActivity): { ok: boolean; text: string } | null {
  if (event.kind === 'scan') return { ok: !!event.allowed, text: event.allowed ? 'Allowed' : 'Denied' };
  if (event.kind === 'trigger' && event.triggerAction) return { ok: event.triggerAction === 'success', text: event.triggerAction };
  return null;
}

export default function DeviceHistory({ items }: { items: DeviceActivity[] }) {
  return (
    <Panel icon="mdi:history" title="History">
      {items.length === 0 ? (
        <p className="text-sm text-label-tertiary">No events recorded yet.</p>
      ) : (
        <ul className={listClass}>
          {items.map((event) => {
            const b = badge(event);
            return (
              <li key={event.id} className="flex items-start gap-3 px-3 py-3 md:px-4">
                <div className="mt-0.5 shrink-0 text-label-secondary">
                  <Icon name={actionIcons[event.kind] ?? 'mdi:circle'} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-label-primary">{actionLabels[event.kind] ?? event.kind}</span>
                    {b && <Tag variant={b.ok ? 'success' : 'error'} className="px-1.5 py-0 leading-[18px]">{b.text}</Tag>}
                    <span className="ml-auto whitespace-nowrap text-xs text-label-tertiary">{formatDate(event.createdAt)}</span>
                  </div>
                  {event.uidHash && (
                    <div className="truncate font-mono text-xs text-label-secondary">
                      {event.username ?? event.uidHash}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
