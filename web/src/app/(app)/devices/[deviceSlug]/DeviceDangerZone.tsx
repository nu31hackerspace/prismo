"use client";

import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import MainButton from '@/components/MainButton';
import Badge from '@/components/Badge';
import {
  isWebSerialSupported,
  connectToDevice,
  flashFirmware,
  disconnectDevice,
  type FlasherState,
  type FlasherLog,
  type FlasherInfo
} from '@/lib/devices';
import type { ESPLoader, Transport } from 'esptool-js';
import { createTokenAction } from './actions';

type Token = { mqttUser: string; mqttPass: string };

interface Props {
  deviceSlug: string;
  deviceMode: 'door' | 'machine';
}

export default function DeviceDangerZone({ deviceSlug, deviceMode }: Props) {
  const [newToken, setNewToken] = useState<Token | null>(null);
  
  const [flasherState, setFlasherState] = useState<FlasherState>('idle');
  const [firmwareFileId, setFirmwareFileId] = useState<string | null>(null);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashLogs, setFlashLogs] = useState<FlasherLog[]>([]);
  const [flashChipInfo, setFlashChipInfo] = useState<FlasherInfo | null>(null);
  const [flashError, setFlashError] = useState('');
  const [flashWifiSsid, setFlashWifiSsid] = useState('');
  const [flashWifiPassword, setFlashWifiPassword] = useState('');
  const [replugCountdown, setReplugCountdown] = useState(0);
  const [bootCountdown, setBootCountdown] = useState(0);

  const esploaderRef = useRef<ESPLoader | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const webSerialSupported = typeof window !== 'undefined' ? isWebSerialSupported() : false;

  function resetFlasher() {
    setFlasherState('idle');
    setFirmwareFileId(null);
    setFlashProgress(0);
    setFlashLogs([]);
    setFlashChipInfo(null);
    setFlashError('');
    setFlashWifiSsid('');
    setFlashWifiPassword('');
    esploaderRef.current = null;
    transportRef.current = null;
  }

  function scrollLogs() {
    if (logContainerRef.current) {
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      });
    }
  }

  const flashCallbacks = {
    onStateChange: (s: FlasherState) => {
      setFlasherState(s);
    },
    onLog: (log: FlasherLog) => {
      setFlashLogs(prev => [...prev, log]);
      scrollLogs();
    },
    onProgress: (pct: number) => {
      setFlashProgress(pct);
    },
    onChipInfo: (info: FlasherInfo) => {
      setFlashChipInfo(info);
    },
    onError: (msg: string) => {
      setFlashError(msg);
    }
  };

  async function handleGenerateToken() {
    try {
      const token = await createTokenAction(deviceSlug);
      setNewToken(token);
      resetFlasher();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate token');
    }
  }

  function closeTokenAlert() {
    setNewToken(null);
    resetFlasher();
  }

  async function handleFlashJob() {
    if (!newToken || !flashWifiSsid || !flashWifiPassword) {
      setFlashError('Please enter your WiFi SSID and password.');
      return;
    }
    setFlasherState('building');
    setFlashError('');
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: flashWifiSsid,
          password: flashWifiPassword,
          mqttUser: newToken.mqttUser,
          mqttPass: newToken.mqttPass,
          mode: deviceMode
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const { jobId } = await res.json();
      pollBuildJob(jobId);
    } catch (err) {
      setFlasherState('error');
      setFlashError(err instanceof Error ? err.message : 'Failed to queue build job');
    }
  }

  function pollBuildJob(id: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error(await res.text());
        const job = await res.json();
        if (job.status === 'completed') {
          clearInterval(interval);
          setFirmwareFileId(String((job.outputPayload as { fileId: number }).fileId));
          setFlasherState('ready');
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setFlasherState('error');
          setFlashError((job.outputPayload as { error?: string })?.error ?? 'Build failed');
        }
      } catch (err) {
        clearInterval(interval);
        setFlasherState('error');
        setFlashError(err instanceof Error ? err.message : 'Failed to poll job status');
      }
    }, 5000);
  }

  async function handleConnect() {
    try {
      setFlashError('');
      const result = await connectToDevice(flashCallbacks);
      esploaderRef.current = result.esploader;
      transportRef.current = result.transport;
    } catch (err) {
      setFlasherState('ready');
      setFlashError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }

  async function handleFlash() {
    if (!esploaderRef.current || !firmwareFileId) return;
    try {
      setFlashError('');
      setFlashProgress(0);
      await flashFirmware(esploaderRef.current, flashCallbacks, `/api/files/${firmwareFileId}`);
      if (transportRef.current) {
        try {
          await disconnectDevice(transportRef.current);
        } catch {
          // ignore
        }
      }
      esploaderRef.current = null;
      transportRef.current = null;
    } catch (err) {
      setFlasherState('error');
      setFlashError(err instanceof Error ? err.message : 'Failed to flash');
    }
  }

  async function handleDisconnect() {
    if (transportRef.current) {
      try {
        await disconnectDevice(transportRef.current);
      } catch {
        // ignore
      }
    }
    setFlasherState('ready');
    esploaderRef.current = null;
    transportRef.current = null;
    setFlashChipInfo(null);
    setFlashProgress(0);
    setFlashLogs([]);
  }

  useEffect(() => {
    if (flasherState !== 'unplug' && flasherState !== 'replug') return;
    function onDisconnect() {
      if (flasherState === 'unplug') setFlasherState('replug');
    }
    function onConnect() {
      if (flasherState === 'replug' && replugCountdown <= 0) setFlasherState('booting');
    }
    navigator.serial?.addEventListener('disconnect', onDisconnect);
    navigator.serial?.addEventListener('connect', onConnect);
    return () => {
      navigator.serial?.removeEventListener('disconnect', onDisconnect);
      navigator.serial?.removeEventListener('connect', onConnect);
    };
  }, [flasherState, replugCountdown]);

  useEffect(() => {
    if (flasherState !== 'replug') return;
    setReplugCountdown(10);
    const iv = setInterval(() => {
      setReplugCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [flasherState]);

  useEffect(() => {
    if (flasherState !== 'booting') return;
    setBootCountdown(15);
    const iv = setInterval(() => {
      setBootCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setFlasherState('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [flasherState]);

  const isPostFlashStep = 
    flasherState === 'unplug' ||
    flasherState === 'replug' ||
    flasherState === 'booting' ||
    flasherState === 'complete';

  type Step = { label: string; detail: string; state: 'done' | 'active' | 'waiting' };
  const postFlashSteps: Step[] = [
    { label: 'Firmware flashed', detail: 'Firmware was written successfully.', state: 'done' },
    {
      label: 'Unplug USB cable',
      detail: 'Remove the USB cable from your Prismo board.',
      state: flasherState === 'unplug' ? 'active' : 'done'
    },
    {
      label: replugCountdown > 0 ? `Wait ${replugCountdown}s…` : 'Wait 10 seconds',
      detail: 'Give the board time to fully power down before restarting.',
      state: flasherState === 'unplug' ? 'waiting' : replugCountdown > 0 ? 'active' : 'done'
    },
    {
      label: 'Plug USB back in',
      detail: 'Reconnect the USB cable to power the board.',
      state:
        flasherState === 'unplug' || replugCountdown > 0
          ? 'waiting'
          : flasherState === 'replug'
            ? 'active'
            : 'done'
    },
    {
      label: bootCountdown > 0 ? `Wait ${bootCountdown}s…` : 'Wait 15 seconds',
      detail: 'Give the board time to fully boot the new firmware.',
      state:
        flasherState === 'unplug' || replugCountdown > 0 || flasherState === 'replug'
          ? 'waiting'
          : flasherState === 'booting'
            ? 'active'
            : 'done'
    },
    {
      label: 'Device is ready',
      detail: 'Prismo is running the new firmware.',
      state: flasherState === 'complete' ? 'done' : 'waiting'
    }
  ];

  return (
    <>
      {newToken && (
        <div className="my-8 rounded-2xl border border-accent-primary/20 bg-accent-primary/[0.03] p-6 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <div className="mt-1 shrink-0 rounded-full bg-accent-primary/10 p-2 text-accent-primary">
                  <Icon icon="mdi:key-variant" className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold text-label-primary">
                    New MQTT Credentials Generated
                  </h3>
                  <p className="mt-1 text-sm text-label-secondary">
                    Copy these credentials now. The password will not be shown again.
                  </p>
                  <div className="mt-4 space-y-2 rounded-lg border border-separator-secondary bg-background-primary p-4 font-mono text-xs text-label-primary shadow-inner">
                    <div><span className="text-label-tertiary">Username: </span>{newToken.mqttUser}</div>
                    <div><span className="text-label-tertiary">Password: </span>{newToken.mqttPass}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-separator-secondary pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <Icon icon="mdi:flash" className="h-5 w-5 text-accent-primary" />
                  <h4 className="font-display text-base font-bold text-label-primary">Flash Firmware</h4>
                </div>

                {!webSerialSupported ? (
                  <div className="rounded-xl border border-separator-secondary bg-background-primary p-4 text-center">
                    <p className="text-sm text-label-secondary">
                      Web Serial API is required. Use <strong>Chrome</strong>, <strong>Edge</strong>, or
                      <strong>Opera</strong> desktop.
                    </p>
                  </div>
                ) : flasherState === 'idle' ? (
                  <>
                    {flashError && <p className="text-red-500 mb-3 text-xs">{flashError}</p>}
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="text"
                        value={flashWifiSsid}
                        onChange={(e) => setFlashWifiSsid(e.target.value)}
                        placeholder="WiFi SSID"
                        className="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
                      />
                      <input
                        type="password"
                        value={flashWifiPassword}
                        onChange={(e) => setFlashWifiPassword(e.target.value)}
                        placeholder="WiFi Password"
                        className="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-label-secondary">
                        Mode: <strong>{deviceMode === 'machine' ? 'Machine Access' : 'Door Lock'}</strong>
                      </span>
                      <MainButton
                        size="S"
                        buttonStyle="primary"
                        icon="mdi:cog"
                        label="Build Firmware"
                        onClick={handleFlashJob}
                      />
                    </div>
                  </>
                ) : isPostFlashStep ? (
                  <ol className="space-y-4">
                    {postFlashSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <div className="shrink-0 pt-0.5">
                          {step.state === 'done' ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary">
                              <Icon icon="mdi:check" className="h-4 w-4 text-background-primary" />
                            </div>
                          ) : step.state === 'active' && i === 2 ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary">
                              <span className="font-display text-xs font-bold text-accent-primary">{replugCountdown}</span>
                            </div>
                          ) : step.state === 'active' && i === 4 ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary">
                              <span className="font-display text-xs font-bold text-accent-primary">{bootCountdown}</span>
                            </div>
                          ) : step.state === 'active' ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary">
                              <Icon icon="mdi:loading" className="h-4 w-4 animate-spin text-accent-primary" />
                            </div>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-separator-secondary bg-background-primary">
                              <span className="font-display text-xs font-bold text-label-tertiary">{i + 1}</span>
                            </div>
                          )}
                        </div>
                        <div className={`flex-1 pb-4 ${i < postFlashSteps.length - 1 ? 'border-b border-separator-secondary' : ''}`}>
                          <p className={`font-display text-sm font-bold ${step.state === 'waiting' ? 'text-label-tertiary' : 'text-label-primary'}`}>
                            {step.label}
                          </p>
                          <p className={`mt-0.5 text-xs ${step.state === 'waiting' ? 'text-label-tertiary' : 'text-label-secondary'}`}>
                            {step.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="space-y-4 rounded-xl border border-separator-secondary bg-background-primary p-5">
                    {flashError && (
                      <div className="border-red-500/20 bg-red-500/5 rounded-lg border p-3">
                        <p className="text-red-500 text-sm">{flashError}</p>
                      </div>
                    )}

                    {flasherState === 'building' ? (
                      <div className="flex flex-col items-center gap-3 py-2 text-center">
                        <Icon icon="mdi:loading" className="h-8 w-8 animate-spin text-accent-primary" />
                        <p className="font-display text-sm font-bold text-label-primary">Building firmware…</p>
                        <p className="text-xs text-label-tertiary">This takes a minute or two. Hold tight.</p>
                      </div>
                    ) : flasherState === 'ready' ? (
                      <>
                        <div className="flex flex-col items-center gap-3 py-2 text-center">
                          <Icon icon="mdi:check-circle" className="h-8 w-8 text-accent-primary" />
                          <p className="font-display text-sm font-bold text-label-primary">Firmware ready!</p>
                          <p className="text-xs text-label-tertiary">Connect your ESP32-C3 via USB to flash it.</p>
                          <p className="text-xs text-label-secondary">
                            <Icon icon="mdi:alert-outline" className="inline h-3.5 w-3.5 align-text-bottom text-label-tertiary" />
                            Plug the device directly into your computer. USB hubs and extension cables may cause flashing failures.
                          </p>
                        </div>
                        <div className="flex justify-center gap-3">
                          <MainButton
                            buttonStyle="primary"
                            size="M"
                            icon="mdi:usb-port"
                            label="Connect Device"
                            onClick={handleConnect}
                          />
                          <MainButton
                            buttonStyle="secondary"
                            size="M"
                            icon="mdi:download"
                            label="Download Firmware"
                            link={`/api/files/${firmwareFileId}`}
                          />
                        </div>
                      </>
                    ) : flasherState === 'connecting' ? (
                      <div className="flex flex-col items-center gap-3 py-2 text-center">
                        <Icon icon="mdi:loading" className="h-8 w-8 animate-spin text-accent-primary" />
                        <p className="font-display text-sm font-bold text-label-primary">Connecting…</p>
                      </div>
                    ) : flasherState === 'connected' ? (
                      <>
                        {flashChipInfo && (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-xs text-label-tertiary">Chip</span>
                              <p className="font-display font-bold text-label-primary">{flashChipInfo.chipName}</p>
                            </div>
                            <div>
                              <span className="text-xs text-label-tertiary">Description</span>
                              <p className="font-display font-bold text-label-primary">{flashChipInfo.chipId}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-center gap-3">
                          <MainButton
                            buttonStyle="primary"
                            size="M"
                            icon="mdi:flash"
                            label="Flash Firmware"
                            onClick={handleFlash}
                          />
                          <MainButton
                            buttonStyle="ghost"
                            size="M"
                            icon="mdi:close"
                            label="Disconnect"
                            onClick={handleDisconnect}
                          />
                        </div>
                      </>
                    ) : flasherState === 'flashing' ? (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-display text-xs font-bold text-label-secondary">Writing firmware</span>
                          <span className="font-display text-xs font-bold text-label-primary">{flashProgress}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-fill-secondary">
                          <div
                            className="h-full rounded-full bg-accent-primary transition-all duration-300 ease-out"
                            style={{ width: `${flashProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : flasherState === 'error' ? (
                      <div className="flex justify-center">
                        <MainButton
                          buttonStyle="secondary"
                          size="M"
                          icon="mdi:refresh"
                          label="Start Over"
                          onClick={resetFlasher}
                        />
                      </div>
                    ) : null}

                    {flashLogs.length > 0 && (
                      <div ref={logContainerRef} className="max-h-36 overflow-y-auto rounded-lg border border-separator-secondary bg-accent-primary p-3">
                        {flashLogs.map((log, i) => (
                          <div key={i} className={`font-display text-xs leading-relaxed ${log.type === 'error' ? 'text-red-400' : 'text-background-primary/70'}`}>
                            <span className="text-background-primary/40 mr-2">{log.timestamp.toLocaleTimeString()}</span>
                            {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {flasherState === 'complete' && (
                  <div className="mt-6">
                    <button
                      onClick={closeTokenAlert}
                      className="w-full rounded-xl border border-accent-primary bg-accent-primary/5 py-2 text-sm font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={closeTokenAlert}
              className="shrink-0 text-label-tertiary hover:text-label-primary"
            >
              <Icon icon="mdi:close" className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <div className="border-red-500/20 bg-red-500/[0.03] mt-6 rounded-2xl border p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
            <Icon icon="mdi:key-variant" className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-label-primary">MQTT Credentials</h2>
          <Badge label="Danger Zone" variant="error" />
        </div>
        <p className="mb-4 text-sm text-label-secondary">
          Regenerate credentials for this device. The previous password will stop working immediately and
          the device will disconnect until reflashed.
        </p>
        <MainButton 
          label="Generate Token" 
          icon="mdi:refresh" 
          buttonStyle="secondary" 
          size="M" 
          onClick={handleGenerateToken} 
        />
      </div>
    </>
  );
}
