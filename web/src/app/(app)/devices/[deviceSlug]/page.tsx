"use client";

import { useEffect, useState, FormEvent, use } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import DeviceActions from "./device-actions";
import DeviceDangerZone from "./device-danger-zone";
import DeviceHistory from "./device-history";

const ONLINE_THRESHOLD_MS = 10_000;

export default function DevicePage({ params }: { params: Promise<{ deviceSlug: string }> }) {
  const { deviceSlug } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceSlug}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        if (res.status === 404) {
          window.location.href = "/devices";
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [deviceSlug]);

  if (loading) {
    return <div className="flex justify-center py-20 text-label-secondary">Loading...</div>;
  }
  if (!data || !data.device) {
    return null; // redirecting
  }

  const { device, keys, historyItems, lastUnauth } = data;
  const isOnline = device.lastSeenAt ? Date.now() - new Date(device.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS : false;

  const handleAddKeySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const keyId = formData.get("keyId")?.toString().trim();
    const name = formData.get("name")?.toString().trim();
    if (!keyId) return;
    
    await fetch(`/api/devices/${deviceSlug}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, name }),
    });
    fetchData();
  };

  const handleRemoveKeySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const keyId = formData.get("keyId")?.toString().trim();
    if (!keyId) return;
    
    await fetch(`/api/devices/${deviceSlug}/keys`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    fetchData();
  };

  return (
    <>
      <header className="sticky top-14 z-30 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg md:top-0">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/devices" className="flex items-center gap-1 text-label-secondary transition-colors hover:text-label-primary">
              <Icon name="mdi:arrow-left" className="h-5 w-5" />
            </Link>
            <span className="truncate font-display text-xl font-bold tracking-tight text-label-primary">{device.name}</span>
            <Tag variant={isOnline ? 'success' : 'error'}>{isOnline ? 'Online' : 'Offline'}</Tag>
          </div>
          <span className="hidden rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-1 font-mono text-xs text-label-tertiary sm:inline">
            {device.deviceSlug}
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
                  <div className="font-mono text-sm break-all text-label-primary">{lastUnauth.keyId}</div>
                  <div className="mt-1 text-xs text-label-tertiary">{formatDate(lastUnauth.createdAt)}</div>
                </div>
                <form onSubmit={handleAddKeySubmit} className="flex gap-2">
                  <input type="hidden" name="keyId" value={lastUnauth.keyId} />
                  <input type="text" name="name" placeholder="Name (e.g. Alice)" required className="flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary" />
                  <Button type="submit" variant="primary" size="sm" icon="mdi:plus">Add</Button>
                </form>
              </div>
            )}

            <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
                  <Icon name="mdi:account-key" className="h-5 w-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-label-primary">Allowed Keys</h2>
                <span className="ml-auto rounded-full border border-separator-secondary bg-background-primary px-2 py-0.5 text-xs text-label-tertiary">{keys.length}</span>
              </div>
              {keys.length === 0 ? (
                <p className="text-sm text-label-tertiary">No keys allowed yet. Add a key from the unauthorized scan panel.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {keys.map((key: any) => (
                    <div key={key.keyId} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-label-primary">{key.name}</div>
                        <div className="font-mono text-xs break-all text-label-tertiary">{key.keyId}</div>
                      </div>
                      <form onSubmit={handleRemoveKeySubmit}>
                        <input type="hidden" name="keyId" value={key.keyId} />
                        <Button type="submit" variant="ghost" size="sm" icon="mdi:delete-outline">Remove</Button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DeviceActions deviceSlug={device.deviceSlug} deviceMode={device.mode ?? "door"} modeParams={device.modeParams ?? {}} />
          </div>

          <div className="flex flex-col gap-6">
            <DeviceHistory items={historyItems} />
          </div>
        </div>

        <DeviceDangerZone deviceSlug={device.deviceSlug} deviceMode={device.mode ?? "door"} />
      </main>
    </>
  );
}
