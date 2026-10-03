import { useState } from "react";
import { Button } from "@/components/ui/button";
import { flashFirmware } from "@/client/flasher";

export default function DeviceFlash() {
  const supported = typeof navigator !== "undefined" && "serial" in navigator;
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
      await flashFirmware(port, "/firmware.bin", setBusyLabel);
      setNotice("Firmware flashed successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flashing failed.");
    } finally {
      setBusyLabel("");
      setPhase("idle");
    }
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-64 flex-1">
          <h3 className="font-display text-base font-bold text-label-primary">Flash Firmware</h3>
          <p className="mt-1 text-sm text-label-secondary">Upload the latest Prismo firmware to the device over USB.</p>
        </div>
      </div>

      {!supported ? (
        <p className="text-sm text-label-tertiary">
          Plug the device into this computer with a USB cable and open this page in Chrome or Edge on a desktop to flash it.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {notice && <p className="text-sm text-accent-primary">{notice}</p>}
          {busyLabel && <p className="text-sm text-label-tertiary">{busyLabel}</p>}

          <div>
            <Button tag="device_flash_start" variant="primary" size="md" icon="mdi:flash" onClick={handleFlash} disabled={busy}>
              {busy ? "Flashing..." : "Flash Firmware"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
