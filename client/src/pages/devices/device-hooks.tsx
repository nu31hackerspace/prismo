import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { draft } from "@/store/models/base";
import type { Device } from "@/store/models";
import { workspaceHeader } from "@/store/workspace-id";

const DISCORD_WEBHOOK_PATTERN = "https://(canary\\.|ptb\\.)?discord(app)?\\.com/api/webhooks/.+";

const DeviceHooks = observer(function DeviceHooks({ device }: { device: Device }) {
  const [url, setUrl] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    draft(device.store, "hook", { deviceId: device.id, kind: "discord", url: url.trim() }).save();
    setUrl("");
  };

  const handleRemove = (hookId: string) =>
    fetch(`/api/entities/${hookId}`, { method: "DELETE", headers: workspaceHeader() });

  return (
    <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
          <Icon name="mdi:webhook" className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-label-primary">Discord Notifications</h2>
      </div>
      <p className="mb-4 text-sm text-label-tertiary">
        Posts to a Discord channel whenever this door is opened. Create a webhook in Discord under Channel Settings → Integrations → Webhooks, then paste its URL here.
      </p>

      {device.hooks.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2">
          {device.hooks.map((hook) => (
            <div key={hook.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
              <div className="truncate font-mono text-xs text-label-tertiary">{hook.url.replace(/[^/]+$/, "•••")}</div>
              <Button tag="device_remove_hook" variant="ghost" size="sm" icon="mdi:delete-outline" onClick={() => handleRemove(hook.id)}>Remove</Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input type="url" required pattern={DISCORD_WEBHOOK_PATTERN} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="Discord webhook URL" className="min-w-0 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary" />
        <Button tag="device_add_hook" type="submit" variant="primary" size="sm" icon="mdi:plus">Add</Button>
      </form>
    </div>
  );
});

export default DeviceHooks;
