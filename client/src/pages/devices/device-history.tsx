import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/utils";

import type { DeviceActivity } from "@/store/models";

export default function DeviceHistory({ items }: { items: DeviceActivity[] }) {
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

  return (
    <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
          <Icon name="mdi:history" className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-label-primary">History</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-label-tertiary">No events recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((event) => (
            <li key={event.id} className="flex items-start gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
              <div className="mt-0.5 shrink-0 text-label-secondary">
                <Icon name={actionIcons[event.kind] ?? 'mdi:circle'} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-label-primary">{actionLabels[event.kind] ?? event.kind}</span>
                  {event.kind === 'scan' && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${event.allowed ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {event.allowed ? 'Allowed' : 'Denied'}
                    </span>
                  )}
                  {event.kind === 'trigger' && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${event.triggerAction === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {event.triggerAction}
                    </span>
                  )}
                </div>
                {event.uidHash && (
                  <div className="font-mono text-xs break-all text-label-secondary">
                    {event.uidHash}{event.username ? ` · ${event.username}` : ''}
                  </div>
                )}
                <div className="mt-0.5 text-xs text-label-tertiary">
                  {formatDate(event.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
