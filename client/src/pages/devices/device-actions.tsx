import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

import type { Device } from "@prismo/shared/entities";

export default function DeviceActions({ deviceId, deviceMode, modeParams }: { deviceId: string, deviceMode: string, modeParams: Device['modeParams'] }) {

  async function handleTrigger(action: string) {
    try {
      await fetch(`/api/devices/${deviceId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSync() {
    try {
      await fetch(`/api/devices/${deviceId}/sync`, { method: "POST" });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
          <Icon name="mdi:remote" className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-label-primary">Quick Actions</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {deviceMode === "door" ? (
          <>
            <Button
              tag="device_action_open_door"
              variant="primary"
              size="md"
              icon="mdi:lock-open-variant"
              onClick={() => handleTrigger("success")}
            >
              Open Door
            </Button>
            <Button
              tag="device_action_alarm"
              variant="ghost"
              size="md"
              icon="mdi:alert-circle-outline"
              onClick={() => handleTrigger("error")}
            >
              Alarm
            </Button>
          </>
        ) : (
          <>
            <Button
              tag="device_action_power_on"
              variant="ghost"
              size="md"
              icon="mdi:power"
              onClick={() => handleTrigger("on")}
            >
              Power ON
            </Button>
            <Button
              tag="device_action_power_off"
              variant="ghost"
              size="md"
              icon="mdi:power-off"
              onClick={() => handleTrigger("off")}
            >
              Power OFF
            </Button>
          </>
        )}

        <Button
          tag="device_action_force_sync"
          variant="ghost"
          size="md"
          icon="mdi:sync"
          onClick={handleSync}
        >
          Force Sync Keys
        </Button>
      </div>
    </div >
  );
}
