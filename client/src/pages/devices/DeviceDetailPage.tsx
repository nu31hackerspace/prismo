import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useStore } from "@/store/provider";
import { draft } from "@/store/models/base";
import DeviceActions from "./device-actions";
import DeviceDangerZone from "./device-danger-zone";
import DeviceHistory from "./device-history";
import { workspaceHeader } from "@/store/workspace-id";

const DeviceDetailPage = observer(function DeviceDetailPage() {
  const { deviceId = "" } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const store = useStore();
  const device = store.allDevices.find((d) => d.id === deviceId);

  const [newKeyName, setNewKeyName] = useState("");

  useEffect(() => {
    if (!store.ready || device) return;
    // The workspace snapshot is loaded and has no such device — either it
    // was deleted or the URL is stale.
    navigate("/devices", { replace: true });
  }, [store.ready, device, navigate]);

  if (!store.ready) {
    return <div className="flex justify-center py-20 text-label-secondary">Loading...</div>;
  }
  if (!device) {
    return null;
  }

  // device.activity rides in the same sync protocol as everything else —
  // history and the last-unauthorized-scan are both just derived views over it.
  const historyItems = device.activity;
  const lastScan = device.activity.find((a) => a.kind === "scan" && a.uidHash) ?? null;
  const workspaceKeys = store.allKeys.filter((k) => k.workspaceId === device.workspaceId);
  const scannedKey = lastScan
    ? workspaceKeys.find((k) => k.id === lastScan.keyId) ?? workspaceKeys.find((k) => k.uidHash === lastScan.uidHash)
    : undefined;
  const lastUnauth = lastScan && !device.keys.some((k) => k.id === scannedKey?.id) ? lastScan : null;

  const handleGrantKey = (keyId: string) => {
    draft(store.entities, "keyAccess", { deviceId, keyId }).save();
  };

  const handleAddKey = () => {
    if (!newKeyName.trim() || !lastUnauth?.uidHash) return;

    // The key's id is generated locally, so the keyAccess row linking it to
    // this device can be created right alongside it, with no round trip to
    // the backend in between — both show up in the UI immediately.
    const key = draft(store.entities, "key", {
      uidHash: lastUnauth.uidHash,
      label: newKeyName.trim(),
      createdAt: new Date().toISOString(),
    }).save();
    draft(store.entities, "keyAccess", { deviceId, keyId: key.id }).save();

    setNewKeyName("");
  };

  const handleRemoveKey = async (keyId: string) => {
    const keyAccess = device.store.allOf("keyAccess").find((ka) => ka.deviceId === device.id && ka.keyId === keyId);
    if (!keyAccess) return;

    await fetch(`/api/entities/${keyAccess.id}`, { method: "DELETE", headers: workspaceHeader() });
  };

  return (
    <>
      <header className="sticky top-14 z-30 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg md:top-0">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/devices" className="flex items-center gap-1 text-label-secondary transition-colors hover:text-label-primary">
              <Icon name="mdi:arrow-left" className="h-5 w-5" />
            </Link>
            <span className="truncate font-display text-xl font-bold tracking-tight text-label-primary">{device.name}</span>
            <Tag variant={device.online ? 'success' : 'error'}>{device.online ? 'Online' : 'Offline'}</Tag>
          </div>
          <span className="hidden rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-1 font-mono text-xs text-label-tertiary sm:inline">
            {device.id}
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            {lastUnauth && (
              <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
                    <Icon name="mdi:key-alert" className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-label-primary">Last Unauthorized Scan</h2>
                </div>
                <div className="mb-4 rounded-lg border border-separator-secondary bg-background-primary p-3">
                  <div className="font-mono text-sm break-all text-label-primary">{lastUnauth.uidHash}</div>
                  <div className="mt-1 text-xs text-label-tertiary">{formatDate(lastUnauth.createdAt)}</div>
                </div>
                {scannedKey ? (
                  <Button tag="device_grant_existing_key_from_scan" variant="primary" size="sm" icon="mdi:plus" onClick={() => handleGrantKey(scannedKey.id)}>
                    Add key '{scannedKey.label}' to this device
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Name (e.g. Alice)" className="flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary" />
                    <Button tag="device_add_key_from_scan" variant="primary" size="sm" icon="mdi:plus" onClick={handleAddKey}>Add</Button>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
                  <Icon name="mdi:account-key" className="h-5 w-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-label-primary">Allowed Keys</h2>
                <span className="ml-auto rounded-full border border-separator-secondary bg-background-primary px-2 py-0.5 text-xs text-label-tertiary">{device.keys.length}</span>
              </div>
              {device.keys.length === 0 ? (
                <p className="text-sm text-label-tertiary">No keys allowed yet. Add a key from the unauthorized scan panel.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {device.keys.map((key) => (
                    <div key={key.id} data-allowed-key-id={key.uidHash} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-label-primary">{key.label}</div>
                        <div className="font-mono text-xs break-all text-label-tertiary">{key.uidHash}</div>
                      </div>
                      <div>
                        <Button tag="device_remove_key" variant="ghost" size="sm" icon="mdi:delete-outline" onClick={() => handleRemoveKey(key.id)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DeviceActions deviceId={device.id} deviceMode={device.mode} modeParams={device.modeParams} />
          </div>

          <div className="flex flex-col gap-6">
            <DeviceHistory items={historyItems} />
          </div>
        </div>

        <DeviceDangerZone deviceId={device.id} deviceMode={device.mode} />
      </main>
    </>
  );
});

export default DeviceDetailPage;
