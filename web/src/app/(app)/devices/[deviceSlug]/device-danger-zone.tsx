"use client";

import { useState, FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { flashAndConfigure, readDeviceState } from "@/lib/flasher";

export default function DeviceDangerZone({ deviceSlug, deviceMode }: { deviceSlug: string, deviceMode: string }) {
  const [token, setToken] = useState<{ mqttUser: string; mqttPass: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [flashWifiSsid, setFlashWifiSsid] = useState("");
  const [flashWifiPassword, setFlashWifiPassword] = useState("");
  const [showFlashWifiPassword, setShowFlashWifiPassword] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashError, setFlashError] = useState("");

  const canDelete = deleteConfirmation === deviceSlug;

  async function handleCreateToken(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/devices/${deviceSlug}/token`, { method: "POST" });
      if (res.ok) {
        const { token: t } = await res.json();
        setToken(t);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/devices/${deviceSlug}`, { method: "DELETE" });
      window.location.href = "/devices";
    } catch (e) {
      setDeleting(false);
      console.error(e);
    }
  }

  async function handleFlash() {
    if (!token || !flashWifiSsid || !flashWifiPassword) {
      setFlashError("Please enter WiFi SSID and password.");
      return;
    }
    try {
      setFlashError("");
      const port = await (navigator as any).serial.requestPort();
      setIsFlashing(true);
      const config = {
        ssid: flashWifiSsid,
        password: flashWifiPassword,
        mqttUser: token.mqttUser,
        mqttPass: token.mqttPass,
        mode: deviceMode,
      };
      await flashAndConfigure(port, "/firmware.bin", config, (msg) => {
        console.log(msg);
      });
      const state = await readDeviceState(port);
      console.log("Device State after flash:", state);
      alert("Flashing complete!");
    } catch (e) {
      setFlashError(e instanceof Error ? e.message : "Flashing failed.");
    } finally {
      setIsFlashing(false);
    }
  }

  return (
    <>
      {token && (
        <div className="my-8 rounded-2xl border border-accent-primary/20 bg-accent-primary/[0.03] p-6 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <div className="mt-1 shrink-0 rounded-full bg-accent-primary/10 p-2 text-accent-primary">
                  <Icon name="mdi:key-variant" className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold text-label-primary">New MQTT Credentials Generated</h3>
                  <p className="mt-1 text-sm text-label-secondary">Copy these credentials now. The password will not be shown again.</p>
                  <div className="mt-4 space-y-2 rounded-lg border border-separator-secondary bg-background-primary p-4 font-mono text-xs text-label-primary shadow-inner">
                    <div><span className="text-label-tertiary">Username: </span>{token.mqttUser}</div>
                    <div><span className="text-label-tertiary">Password: </span>{token.mqttPass}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-separator-secondary pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <Icon name="mdi:flash" className="h-5 w-5 text-accent-primary" />
                  <h4 className="font-display text-base font-bold text-label-primary">Flash Firmware</h4>
                </div>

                <div className="flex flex-wrap gap-3">
                  <input type="text" value={flashWifiSsid} onChange={e => setFlashWifiSsid(e.target.value)} placeholder="WiFi SSID" className="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary" />
                  <div className="relative min-w-32 flex-1">
                    <input type={showFlashWifiPassword ? "text" : "password"} value={flashWifiPassword} onChange={e => setFlashWifiPassword(e.target.value)} placeholder="WiFi Password" className="w-full rounded-xl border border-separator-secondary bg-background-primary py-2 pr-10 pl-3 text-sm text-label-primary outline-none focus:border-accent-primary" />
                    <button type="button" onClick={() => setShowFlashWifiPassword(!showFlashWifiPassword)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-label-secondary hover:text-label-primary">
                      <Icon name={showFlashWifiPassword ? "mdi:eye-off" : "mdi:eye"} />
                    </button>
                  </div>
                </div>
                {flashError && <p className="text-red-500 mt-2 text-sm">{flashError}</p>}
                <div className="mt-3">
                  <Button variant="primary" size="sm" icon="mdi:usb-port" onClick={handleFlash} disabled={isFlashing}>
                    {isFlashing ? "Flashing..." : "Flash Device"}
                  </Button>
                </div>
              </div>
            </div>
            <button onClick={() => setToken(null)} className="shrink-0 text-label-tertiary hover:text-label-primary">
              <Icon name="mdi:close" className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <div className="border-red-500/20 bg-red-500/[0.03] mt-6 rounded-2xl border p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
            <Icon name="mdi:alert-outline" className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-label-primary">Danger Zone</h2>
          <Tag variant="error">Irreversible</Tag>
        </div>

        <div className="divide-y divide-separator-secondary overflow-hidden rounded-xl border border-separator-secondary bg-background-primary">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-64 flex-1">
              <h3 className="font-display text-base font-bold text-label-primary">MQTT Credentials</h3>
              <p className="mt-1 text-sm text-label-secondary">Regenerate credentials for this device.</p>
            </div>
            <form onSubmit={handleCreateToken}>
              <Button type="submit" variant="ghost" size="md" icon="mdi:tools">Setup Device</Button>
            </form>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-64 flex-1">
                <h3 className="font-display text-base font-bold text-label-primary">Delete Device</h3>
                <p className="mt-1 text-sm text-label-secondary">Permanently removes this device.</p>
              </div>
              {!confirmingDelete && (
                <button type="button" onClick={() => setConfirmingDelete(true)} className="border-red-500/40 text-red-500 hover:bg-red-500/10 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition-colors">
                  <Icon name="mdi:delete-outline" className="h-6 w-6" /> Delete Device
                </button>
              )}
            </div>

            {confirmingDelete && (
              <div className="border-red-500/20 bg-red-500/5 mt-4 rounded-xl border p-4">
                <label htmlFor="confirm-slug" className="text-sm text-label-secondary">Type <strong className="font-mono text-label-primary">{deviceSlug}</strong> to confirm.</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <input id="confirm-slug" type="text" autoComplete="off" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={deviceSlug} className="min-w-48 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 font-mono text-sm text-label-primary outline-none focus:border-accent-primary" />
                  <button type="button" onClick={handleDelete} disabled={!canDelete || deleting} className="bg-red-500 hover:bg-red-600 text-white inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40">
                    <Icon name={deleting ? "mdi:loading" : "mdi:delete-forever"} className={`h-5 w-5 ${deleting ? "animate-spin" : ""}`} /> {deleting ? "Deleting…" : "Delete Forever"}
                  </button>
                  <button type="button" onClick={() => { setConfirmingDelete(false); setDeleteConfirmation(""); }} className="rounded-lg px-4 py-2 text-sm font-bold text-label-secondary transition-colors hover:bg-fill-tertiary hover:text-label-primary">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
