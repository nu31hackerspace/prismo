import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Button } from "@/components/ui/button";
import { draft } from "@/store/models/base";
import type { Device } from "@/store/models";
import { workspaceHeader } from "@/store/workspace-id";
import { inputClass, listClass, Panel } from "./panel";

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
    <Panel icon="mdi:webhook" title="Discord Notifications">
      <p className="mb-4 hidden text-sm text-label-tertiary md:block">
        Posts to a Discord channel whenever this door is opened. Create a webhook in Discord under Channel Settings → Integrations → Webhooks, then paste its URL here.
      </p>

      {device.hooks.length > 0 && (
        <div className={listClass + " mb-4"}>
          {device.hooks.map((hook) => (
            <div key={hook.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-1 pr-1 pl-3 md:py-3 md:pr-2 md:pl-4">
              <div className="truncate font-mono text-xs text-label-tertiary">{hook.url.replace(/[^/]+$/, "•••")}</div>
              <Button tag="device_remove_hook" variant="ghost" size="sm" icon="mdi:delete-outline" aria-label="Remove" onClick={() => handleRemove(hook.id)} className="h-11 w-11 px-0 md:h-9 md:w-auto md:px-3">
                <span className="hidden md:inline">Remove</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input type="url" required pattern={DISCORD_WEBHOOK_PATTERN} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="Discord webhook URL" className={inputClass + " flex-1"} />
        <Button tag="device_add_hook" type="submit" variant="primary" size="sm" icon="mdi:plus" className="h-12 rounded-md text-base md:h-9 md:rounded md:text-sm">Add</Button>
      </form>
    </Panel>
  );
});

export default DeviceHooks;
