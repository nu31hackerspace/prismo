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
import DeviceFirmwareDownload from "./device-firmware-download";
import DeviceHistory from "./device-history";
import DeviceHooks from "./device-hooks";
import DeviceHardware from "./device-hardware";
import { inputClass, listClass, Panel } from "./panel";
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

  const initials = (label: string) =>
    label.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <>
      <header className="sticky top-14 z-30 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg md:top-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/devices" className="flex items-center text-label-secondary transition-colors hover:text-label-primary">
              <Icon name="mdi:arrow-left" className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="truncate font-display text-xl font-bold tracking-tight text-label-primary">{device.name}</span>
                <Tag variant={device.online ? 'success' : 'error'}>{device.online ? 'Online' : 'Offline'}</Tag>
                <Tag icon={device.mode === "door" ? "mdi:door" : "mdi:power"} className="ml-auto capitalize md:ml-0">
                  {device.mode}<span className="hidden md:inline"> mode</span>
                </Tag>
              </div>
              <div className="mt-0.5 truncate text-xs text-label-tertiary md:font-mono">
                <span className="hidden md:inline">{device.id} · </span>
                Last seen {device.lastSeenAt ? formatDate(device.lastSeenAt) : "never"}
              </div>
            </div>
          </div>
          <DeviceActions deviceId={device.id} deviceMode={device.mode} />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 pb-12 md:gap-6 md:px-6 md:pt-8 md:pb-20">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4 md:gap-6">
            <Panel
              icon="mdi:account-key"
              title="Allowed Keys"
              aside={<span className="ml-auto rounded-full border border-separator-secondary bg-background-primary px-2 py-0.5 text-xs text-label-tertiary">{device.keys.length}</span>}
            >
              {lastUnauth && (
                <div className="mb-4 rounded-xl border border-status-error/30 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-status-error/10 p-2 text-status-error">
                      <Icon name="mdi:key-alert" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-3">
                        <h3 className="text-sm font-semibold text-label-primary">{scannedKey ? `'${scannedKey.label}' has no access here` : "Unknown key scanned"}</h3>
                        <span className="text-xs text-label-tertiary">{formatDate(lastUnauth.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-label-secondary">{lastUnauth.uidHash}</div>
                    </div>
                  </div>
                  {scannedKey ? (
                    <div className="mt-3 md:pl-12">
                      <Button tag="device_grant_existing_key_from_scan" variant="primary" size="sm" icon="mdi:plus" onClick={() => handleGrantKey(scannedKey.id)}>
                        Grant access
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:pl-12">
                      <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Name (e.g. Alice)" className={inputClass + " flex-1 bg-background-primary"} />
                      <Button tag="device_add_key_from_scan" variant="primary" size="sm" icon="mdi:plus" onClick={handleAddKey} className="h-12 rounded-md text-base md:h-9 md:rounded md:text-sm">Grant access</Button>
                    </div>
                  )}
                </div>
              )}

              {device.keys.length === 0 ? (
                <p className="text-sm text-label-tertiary">No keys allowed yet. Scan a key on the device to add it here.</p>
              ) : (
                <div className={listClass}>
                  {device.keys.map((key) => (
                    <div key={key.id} data-allowed-key-id={key.uidHash} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-1.5 pr-1 pl-3 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:py-2.5 md:pr-2 md:pl-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-separator-secondary bg-fill-tertiary text-xs font-semibold text-label-primary">{initials(key.label)}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-label-primary">{key.label}</div>
                        <div className="truncate font-mono text-xs text-label-tertiary">{key.uidHash}</div>
                      </div>
                      <span className="hidden text-xs text-label-tertiary md:inline">Added {formatDate(key.createdAt).slice(0, 10)}</span>
                      <Button tag="device_remove_key" variant="ghost" size="sm" icon="mdi:delete-outline" aria-label="Remove" onClick={() => handleRemoveKey(key.id)} className="h-11 w-11 px-0 md:h-9 md:w-auto md:px-3">
                        <span className="hidden md:inline">Remove</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <DeviceHooks device={device} />
          </div>

          <DeviceHistory items={historyItems} />
        </div>

        <DeviceHardware deviceId={device.id} deviceMode={device.mode} />
        <DeviceFirmwareDownload />
        <DeviceDangerZone deviceId={device.id} />
      </main>
    </>
  );
});

export default DeviceDetailPage;
