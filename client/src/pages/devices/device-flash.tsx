import { useState } from "react";
import { Button } from "@/components/ui/button";
import { flashFirmware } from "@/client/flasher";
import { env } from "@/lib/env";
import { outlineClass } from "./panel";

export default function DeviceFlash({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "flashing">("idle");
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const busy = phase === "flashing";

  async function handleFlash() {
    setError("");
    setNotice("");
    setPhase("flashing");
    try {
      const port = await navigator.serial.requestPort();
      await flashFirmware(port, `/${env.firmwareFile}`, setBusyLabel);
      setNotice("Firmware flashed successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flashing failed.");
    } finally {
      setBusyLabel("");
      setPhase("idle");
    }
  }

  const messages = (
    <>
      {error && <p className="text-sm text-status-error">{error}</p>}
      {notice && <p className="text-sm text-status-success">{notice}</p>}
      {busyLabel && <p className="text-sm text-label-tertiary">{busyLabel}</p>}
    </>
  );
  const button = (
    <Button tag="device_flash_start" variant="ghost" size={compact ? "sm" : "md"} icon="mdi:flash" onClick={handleFlash} disabled={busy} className={outlineClass}>
      {busy ? "Flashing..." : "Flash Firmware"}
    </Button>
  );
  const description = <p className="text-sm text-label-secondary">Upload the latest Prismo firmware to the device over USB.</p>;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-separator-secondary bg-background-primary py-3 pr-3 pl-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-label-primary">Flash Firmware</div>
            {description}
          </div>
          {button}
        </div>
        {messages}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-separator-secondary bg-background-primary p-5">
      <div>
        <h3 className="font-display text-base font-bold text-label-primary">Flash Firmware</h3>
        <div className="mt-1">{description}</div>
      </div>
      {messages}
      {button}
    </div>
  );
}
