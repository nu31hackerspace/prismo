import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { workspaceHeader } from "@/store/workspace-id";

export default function DeviceDangerZone({ deviceId }: { deviceId: string }) {
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
    <section className="rounded-2xl border border-status-error/20 bg-status-error/[0.03] p-4 md:px-6 md:py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="hidden rounded-xl bg-background-primary p-2 text-status-error md:block">
          <Icon name="mdi:alert-outline" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-bold text-label-primary">Delete Device</h2>
            <Tag variant="error" className="px-2 py-0.5">Irreversible</Tag>
          </div>
          <p className="mt-0.5 text-sm text-label-secondary">Permanently removes this device.</p>
        </div>
        {!confirmingDelete && (
          <Button tag="device_delete_start" variant="ghost" onClick={() => setConfirmingDelete(true)} icon="mdi:delete-outline" className="w-full border border-status-error/40 font-bold text-status-error hover:bg-status-error/10 md:w-auto">Delete Device</Button>
        )}
      </div>

      {confirmingDelete && (
        <div className="mt-4 rounded-xl border border-status-error/20 bg-status-error/5 p-4">
          <label htmlFor="confirm-slug" className="text-sm text-label-secondary">Type <strong className="font-mono text-label-primary">{deviceId}</strong> to confirm.</label>
          <div className="mt-3 flex flex-wrap gap-3">
            <input id="confirm-slug" type="text" autoComplete="off" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={deviceId} className="min-w-48 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 font-mono text-sm text-label-primary outline-none focus:border-accent-primary" />
            <Button tag="device_delete_confirm" variant="primary" onClick={handleDelete} disabled={!canDelete} icon="mdi:delete-forever" className="border-status-error bg-status-error font-bold hover:border-status-error hover:bg-status-error/90">Delete Forever</Button>
            <Button tag="device_delete_cancel" variant="ghost" onClick={() => { setConfirmingDelete(false); setDeleteConfirmation(""); }} className="font-bold">Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}
