import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/provider";
import { draft } from "@/store/models/base";
import type { Key, Device } from "@/store/models";
import { workspaceHeader } from "@/store/workspace-id";

const KeyCard = observer(function KeyCard({ keyItem, allDevices, onAttach, onDetach, onDelete }: {
  keyItem: Key,
  allDevices: Device[],
  onAttach: (k: string, d: string) => void,
  onDetach: (k: string, d: string) => void,
  onDelete: (k: string) => void
}) {
  const [selectedDevice, setSelectedDevice] = useState("");
  const attachedSet = new Set(keyItem.devices.map(d => d.id));
  const candidateDevices = allDevices.filter(d => !attachedSet.has(d.id));

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-label-primary">{keyItem.label}</div>
          <div className="mt-2 font-mono text-xs break-all text-label-tertiary">{keyItem.id.substring(0, 8)}...</div>
        </div>
        <div>
          <Button tag="key_delete" variant="ghost" size="sm" icon="mdi:delete-outline" onClick={() => onDelete(keyItem.id)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-separator-secondary pt-3 mt-4">
        <div className="text-xs font-bold text-label-tertiary uppercase tracking-wider">Access to:</div>
        {keyItem.devices.length > 0 ? (
          keyItem.devices.map(device => (
            <div key={device.id} className="flex items-center gap-1 rounded-full border border-separator-secondary bg-background-primary py-1 pr-1 pl-3 text-xs text-label-secondary">
              <span>{device.name}</span>
              <button type="button" onClick={() => onDetach(keyItem.id, device.id)} className="flex h-5 w-5 items-center justify-center rounded-full text-label-tertiary transition-colors hover:bg-fill-secondary hover:text-label-primary">
                <Icon name="mdi:close" className="h-3 w-3" />
              </button>
            </div>
          ))
        ) : (
          <span className="text-xs text-label-tertiary italic">No devices</span>
        )}

        <div className="ml-auto">
          <div className="flex gap-2">
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="rounded-lg border border-separator-secondary bg-background-primary px-2 py-1 text-xs text-label-primary outline-none focus:border-accent-primary">
              <option value="" disabled>Grant access...</option>
              {candidateDevices.map(device => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
            <Button tag="key_attach_device" variant="ghost" size="sm" icon="mdi:plus" onClick={() => { if(selectedDevice) { onAttach(keyItem.id, selectedDevice); setSelectedDevice(""); } }}>Add</Button>
          </div>
        </div>
      </div>
    </div>
  );
});

const KeysPage = observer(function KeysPage() {
  const store = useStore();

  const attachDeviceSubmit = (keyId: string, deviceId: string) => {
    if (!keyId || !deviceId) return;
    draft(store.entities, "keyAccess", { keyId, deviceId }).save();
  };

  const detachDeviceSubmit = async (keyId: string, deviceId: string) => {
    if (!keyId || !deviceId) return;
    const keyAccess = store.entities.allOf("keyAccess").find((ka) => ka.keyId === keyId && ka.deviceId === deviceId);
    if (!keyAccess) return;

    await fetch(`/api/entities/${keyAccess.id}`, { method: "DELETE", headers: workspaceHeader() });
  };

  const deleteKeySubmit = async (keyId: string) => {
    if (!keyId) return;
    await fetch(`/api/entities/${keyId}`, { method: "DELETE", headers: workspaceHeader() });
  };

  const keys = store.allKeys;
  const devices = store.allDevices;
  const loading = !store.ready;

  return (
    <section className="relative overflow-hidden pt-10 pb-20 md:pt-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      ></div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-12 text-left">
          <h1 className="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
            Keys
          </h1>
          <p className="mt-2 text-label-secondary">
            Every NFC key you've named appears here. Attach it to any locker, or revoke it everywhere at once.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><span className="text-label-secondary">Loading...</span></div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20">
            <Icon name="mdi:key-outline" className="mb-4 h-12 w-12 text-label-tertiary" />
            <p className="text-label-secondary">
              No keys yet. Scan an unknown card on any device page and give it a name.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map((key) => (
              <KeyCard
                key={key.id}
                keyItem={key}
                allDevices={devices}
                onAttach={attachDeviceSubmit}
                onDetach={detachDeviceSubmit}
                onDelete={deleteKeySubmit}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
});

export default KeysPage;
