import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import DeviceSetup from "./device-setup";
import { workspaceHeader } from "@/store/workspace-id";

export default function DeviceDangerZone({ deviceId, deviceMode }: { deviceId: string, deviceMode: string }) {
  const navigate = useNavigate();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canDelete = deleteConfirmation === deviceId;

  async function handleDelete() {
    if (!canDelete) return;
    try {
      await fetch(`/api/entities/${deviceId}`, { method: "DELETE", headers: workspaceHeader() });
      navigate("/devices");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <>
      <div className="border-red-500/20 bg-red-500/[0.03] mt-6 rounded-2xl border p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
            <Icon name="mdi:alert-outline" className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-label-primary">Danger Zone</h2>
          <Tag variant="error">Irreversible</Tag>
        </div>

        <div className="divide-y divide-separator-secondary overflow-hidden rounded-xl border border-separator-secondary bg-background-primary">
          <DeviceSetup deviceId={deviceId} deviceMode={deviceMode} />

          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-64 flex-1">
                <h3 className="font-display text-base font-bold text-label-primary">Delete Device</h3>
                <p className="mt-1 text-sm text-label-secondary">Permanently removes this device.</p>
              </div>
              {!confirmingDelete && (
                <Button tag="device_delete_start" variant="ghost" onClick={() => setConfirmingDelete(true)} icon="mdi:delete-outline" className="border-red-500/40 text-red-500 hover:bg-red-500/10 border font-bold">Delete Device</Button>
              )}
            </div>

            {confirmingDelete && (
              <div className="border-red-500/20 bg-red-500/5 mt-4 rounded-xl border p-4">
                <label htmlFor="confirm-slug" className="text-sm text-label-secondary">Type <strong className="font-mono text-label-primary">{deviceId}</strong> to confirm.</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <input id="confirm-slug" type="text" autoComplete="off" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={deviceId} className="min-w-48 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 font-mono text-sm text-label-primary outline-none focus:border-accent-primary" />
                  <Button tag="device_delete_confirm" variant="primary" onClick={handleDelete} disabled={!canDelete} icon="mdi:delete-forever" className="bg-red-500 hover:bg-red-600 border-red-500 hover:border-red-600 font-bold">Delete Forever</Button>
                  <Button tag="device_delete_cancel" variant="ghost" onClick={() => { setConfirmingDelete(false); setDeleteConfirmation(""); }} className="font-bold">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
