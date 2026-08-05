"use client";

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import MainButton from '@/components/MainButton';
import DeviceHistory from './DeviceHistory';
import DeviceDangerZone from './DeviceDangerZone';
import { addKeyAction, removeKeyAction, triggerDeviceAction, syncKeysAction } from './actions';

const ONLINE_THRESHOLD_MS = 10_000;

interface DeviceViewProps {
  device: {
    id: string;
    name: string;
    deviceSlug: string;
    lastSeenAt: number | null;
    mode: 'door' | 'machine';
    modeParams: any;
  };
  keys: Array<{ keyId: string; name: string; addedAt: number }>;
  history: Array<any>;
  lastUnauth: { keyId: string; createdAt: number } | null;
}

export default function DeviceClientView({ device, keys, history: initialHistory, lastUnauth: initialLastUnauth }: DeviceViewProps) {
  const [isOnline, setIsOnline] = useState(
    device.lastSeenAt ? Date.now() - device.lastSeenAt < ONLINE_THRESHOLD_MS : false
  );
  const [historyItems, setHistoryItems] = useState(initialHistory);
  const [lastUnauth, setLastUnauth] = useState(initialLastUnauth);
  const [modeParams, setModeParams] = useState(device.modeParams);
  const machineIsOn = modeParams?.isOn ?? false;

  useEffect(() => {
    const source = new EventSource(`/api/devices/${device.deviceSlug}/events`);
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        setHistoryItems(prev => [event, ...prev].slice(0, 50));
        
        if (event.action === 'scan' && event.keyId && event.username == null) {
          setLastUnauth(prev => {
            if (!prev || new Date(event.createdAt).getTime() > prev.createdAt) {
              return { keyId: event.keyId, createdAt: new Date(event.createdAt).getTime() };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };

    source.addEventListener('status', (e) => {
      setIsOnline(true);
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = setTimeout(() => {
        setIsOnline(false);
      }, ONLINE_THRESHOLD_MS);

      try {
        const payload = JSON.parse((e as MessageEvent).data);
        if (payload.modeParams !== undefined) {
          setModeParams(payload.modeParams);
        }
      } catch {
        /* ignore malformed events */
      }
    });

    source.onerror = () => console.error('[sse] connection error');

    return () => {
      source.close();
      if (offlineTimer) clearTimeout(offlineTimer);
    };
  }, [device.deviceSlug]);

  return (
    <>
      <header className="sticky top-14 z-30 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg md:top-0">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/devices"
              className="flex items-center gap-1 text-label-secondary transition-colors hover:text-label-primary"
              aria-label="Back to devices"
            >
              <Icon icon="mdi:arrow-left" className="h-5 w-5" />
            </Link>
            <span className="truncate font-display text-xl font-bold tracking-tight text-label-primary">
              {device.name}
            </span>
            <Badge label={isOnline ? 'Online' : 'Offline'} variant={isOnline ? 'success' : 'error'} />
          </div>
          <span className="hidden rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-1 font-mono text-xs text-label-tertiary sm:inline">
            {device.deviceSlug}
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            {/* Last Unauthorized Scan */}
            {lastUnauth && (
              <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
                    <Icon icon="mdi:key-alert" className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-label-primary">
                    Last Unauthorized Scan
                  </h2>
                </div>
                <div className="mb-4 rounded-lg border border-separator-secondary bg-background-primary p-3">
                  <div className="font-mono text-sm break-all text-label-primary">{lastUnauth.keyId}</div>
                  <div className="mt-1 text-xs text-label-tertiary">{new Date(lastUnauth.createdAt).toLocaleString()}</div>
                </div>
                <form action={addKeyAction.bind(null, device.deviceSlug)} className="flex gap-2">
                  <input type="hidden" name="keyId" value={lastUnauth.keyId} />
                  <input
                    type="text"
                    name="name"
                    placeholder="Name (e.g. Alice)"
                    required
                    className="flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
                  />
                  <MainButton size="S" buttonStyle="primary" icon="mdi:plus" label="Add" />
                </form>
              </div>
            )}

            {/* Allowed Keys */}
            <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
                  <Icon icon="mdi:account-key" className="h-5 w-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-label-primary">Allowed Keys</h2>
                <span className="ml-auto rounded-full border border-separator-secondary bg-background-primary px-2 py-0.5 text-xs text-label-tertiary">
                  {keys.length}
                </span>
              </div>

              {keys.length === 0 ? (
                <p className="text-sm text-label-tertiary">
                  No keys allowed yet. Add a key from the unauthorized scan panel.
                </p>
              ) : (
                <div data-section="allowed-keys" className="grid grid-cols-1 gap-2">
                  {keys.map(key => (
                    <div
                      key={key.keyId}
                      data-allowed-key-id={key.keyId}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-label-primary">{key.name}</div>
                        <div className="font-mono text-xs break-all text-label-tertiary">{key.keyId}</div>
                      </div>
                      <form action={removeKeyAction.bind(null, device.deviceSlug)}>
                        <input type="hidden" name="keyId" value={key.keyId} />
                        <MainButton size="S" buttonStyle="ghost" icon="mdi:delete-outline" label="Remove" />
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Trigger */}
            <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
                  <Icon icon="mdi:lightning-bolt" className="h-5 w-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-label-primary">Manual Trigger</h2>
              </div>
              <p className="mb-4 text-sm text-label-secondary">
                Manually send a signal to the device, or push the current key list.
              </p>
              <div className="flex flex-wrap gap-3">
                {device.mode === 'machine' ? (
                  <form action={async () => {
                    await triggerDeviceAction(device.deviceSlug, machineIsOn ? 'off' : 'on');
                  }}>
                    <MainButton
                      icon={machineIsOn ? 'mdi:power-off' : 'mdi:power'}
                      label={machineIsOn ? 'Turn Off' : 'Turn On'}
                      buttonStyle={machineIsOn ? 'secondary' : 'primary'}
                      size="M"
                    />
                  </form>
                ) : (
                  <form action={async () => {
                    await triggerDeviceAction(device.deviceSlug, 'success');
                  }}>
                    <MainButton
                      icon="mdi:check-circle-outline"
                      label="Trigger Success"
                      buttonStyle="primary"
                      size="M"
                    />
                  </form>
                )}
                <form action={async () => {
                  await syncKeysAction(device.deviceSlug);
                }}>
                  <MainButton icon="mdi:sync" label="Force Sync Keys" buttonStyle="ghost" size="M" />
                </form>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <DeviceHistory items={historyItems} />
          </div>
        </div>

        <DeviceDangerZone deviceSlug={device.deviceSlug} deviceMode={device.mode} />
      </main>
    </>
  );
}
