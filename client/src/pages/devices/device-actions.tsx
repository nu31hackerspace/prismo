import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { workspaceHeader } from "@/store/workspace-id";

const secondaryClass = "h-12 w-12 border-separator-primary px-0 md:h-9 md:w-auto md:border-transparent md:px-3";

function SecondaryAction({ tag, icon, label, onClick, className }: { tag: string; icon: string; label: string; onClick: () => void; className?: string }) {
  return (
    <Button tag={tag} variant="ghost" size="sm" icon={icon} aria-label={label} onClick={onClick} className={cn(secondaryClass, className)}>
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}

export default function DeviceActions({ deviceId, deviceMode }: { deviceId: string; deviceMode: string }) {
  async function handleTrigger(action: string) {
    try {
      await fetch(`/api/devices/${deviceId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeader() },
        body: JSON.stringify({ action })
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSync() {
    try {
      await fetch(`/api/devices/${deviceId}/sync`, { method: "POST", headers: workspaceHeader() });
    } catch (e) {
      console.error(e);
    }
  }

  const door = deviceMode === "door";

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 md:flex md:items-center">
      <Button
        tag={door ? "device_action_open_door" : "device_action_power_on"}
        variant="primary"
        size="sm"
        icon={door ? "mdi:lock-open-variant" : "mdi:power"}
        onClick={() => handleTrigger(door ? "success" : "on")}
        className="h-12 rounded-md text-base md:order-last md:h-9 md:rounded md:text-sm"
      >
        {door ? "Open Door" : "Power ON"}
      </Button>
      {door ? (
        <SecondaryAction tag="device_action_alarm" icon="mdi:alert-circle-outline" label="Alarm" onClick={() => handleTrigger("error")} />
      ) : (
        <SecondaryAction tag="device_action_power_off" icon="mdi:power-off" label="Power OFF" onClick={() => handleTrigger("off")} />
      )}
      <SecondaryAction tag="device_action_force_sync" icon="mdi:sync" label="Force Sync Keys" onClick={handleSync} className="md:order-first" />
    </div>
  );
}
