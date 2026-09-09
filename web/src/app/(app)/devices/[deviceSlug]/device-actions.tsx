"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

export default function DeviceActions({ deviceSlug, deviceMode, modeParams }: { deviceSlug: string, deviceMode: string, modeParams: any }) {

  async function handleTrigger(action: string) {
    try {
      await fetch(`/api/devices/${deviceSlug}/trigger`, {
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
      await fetch(`/api/devices/${deviceSlug}/sync`, { method: "POST" });
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
              variant="primary"
              size="md"
              icon="mdi:lock-open-variant"
              onClick={() => handleTrigger("success")}
            >
              Open Door
            </Button>
            <Button
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
              variant="ghost"
              size="md"
              icon="mdi:power"
              onClick={() => handleTrigger("on")}
            >
              Power ON
            </Button>
            <Button
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
