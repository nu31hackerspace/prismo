"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

export default function KeysPage() {
  const [keys, setKeys] = useState<any[] | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
        setDevices(data.devices);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const attachDeviceSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const keyId = formData.get("keyId")?.toString().trim();
    const deviceSlug = formData.get("deviceSlug")?.toString().trim();
    if (!keyId || !deviceSlug) return;
    
    await fetch("/api/keys/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, deviceSlug }),
    });
    fetchData();
  };

  const detachDeviceSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const keyId = formData.get("keyId")?.toString().trim();
    const deviceSlug = formData.get("deviceSlug")?.toString().trim();
    if (!keyId || !deviceSlug) return;
    
    await fetch("/api/keys/detach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, deviceSlug }),
    });
    fetchData();
  };

  const deleteKeySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const keyId = formData.get("keyId")?.toString().trim();
    if (!keyId) return;
    
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    fetchData();
  };

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
        ) : keys && keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20">
            <Icon name="mdi:key-outline" className="mb-4 h-12 w-12 text-label-tertiary" />
            <p className="text-label-secondary">
              No keys yet. Scan an unknown card on any device page and give it a name.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {keys && keys.map((key) => {
              const attachedSet = new Set(key.devices.map((d: any) => d.deviceSlug));
              const candidateDevices = devices.filter((d) => !attachedSet.has(d.deviceSlug));

              return (
                <div
                  key={key.keyId}
                  className="flex flex-col justify-between rounded-2xl border border-separator-secondary bg-fill-tertiary p-6"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-label-primary">{key.name}</div>
                      <div className="mt-2 font-mono text-xs break-all text-label-tertiary">{key.keyId}</div>
                    </div>
                    <form onSubmit={deleteKeySubmit}>
                      <input type="hidden" name="keyId" value={key.keyId} />
                      <Button type="submit" variant="ghost" size="sm" icon="mdi:delete-outline">
                        Delete
                      </Button>
                    </form>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-separator-secondary pt-3 mt-4">
                    <div className="text-xs font-bold text-label-tertiary uppercase tracking-wider">Access to:</div>
                    {key.devices.length > 0 ? (
                      key.devices.map((device: any) => (
                        <div key={device.deviceSlug} className="flex items-center gap-1 rounded-full border border-separator-secondary bg-background-primary py-1 pr-1 pl-3 text-xs text-label-secondary">
                          <span>{device.name}</span>
                          <form onSubmit={detachDeviceSubmit}>
                            <input type="hidden" name="keyId" value={key.keyId} />
                            <input type="hidden" name="deviceSlug" value={device.deviceSlug} />
                            <button type="submit" className="flex h-5 w-5 items-center justify-center rounded-full text-label-tertiary transition-colors hover:bg-fill-secondary hover:text-label-primary">
                              <Icon name="mdi:close" className="h-3 w-3" />
                            </button>
                          </form>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-label-tertiary italic">No devices</span>
                    )}
                    
                    <div className="ml-auto">
                      <form onSubmit={attachDeviceSubmit} className="flex gap-2">
                        <input type="hidden" name="keyId" value={key.keyId} />
                        <select name="deviceSlug" required className="rounded-lg border border-separator-secondary bg-background-primary px-2 py-1 text-xs text-label-primary outline-none focus:border-accent-primary" defaultValue="">
                          <option value="" disabled>Grant access...</option>
                          {candidateDevices.map(device => (
                            <option key={device.deviceSlug} value={device.deviceSlug}>{device.name}</option>
                          ))}
                        </select>
                        <Button type="submit" variant="ghost" size="sm" icon="mdi:plus">Add</Button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
