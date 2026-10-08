import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export default function DeviceFirmwareDownload() {
  return (
    <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
          <Icon name="mdi:chip" className="h-5 w-5" />
        </div>
        <div className="min-w-64 flex-1">
          <h2 className="font-display text-lg font-bold text-label-primary">Firmware</h2>
          <p className="mt-1 text-sm text-label-secondary">Download the latest Prismo firmware binary to flash it manually with esptool.</p>
        </div>
        <Button tag="device_firmware_download" variant="ghost" href={`/${env.firmwareFile}`} download={env.firmwareFile} icon="mdi:download" className="border border-separator-secondary font-bold">
          Download Firmware
        </Button>
      </div>
    </div>
  );
}
