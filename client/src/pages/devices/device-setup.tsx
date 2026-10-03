import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import {
  appendLogLine,
  connectDevice,
  DeviceRequestError,
  reconnectAfterReset,
  type DeviceInfo,
  type DeviceSerial,
  type DeviceSerialHandlers,
  type DeviceStatus,
  type DeviceValues,
  type SettingDef,
} from "@/client/device-serial";
import { workspaceHeader } from "@/store/workspace-id";
import { DeviceSettingsForm } from "./device-settings-form";
import { changedValues, draftFromValues, type Draft } from "./device-settings";

type Phase = "idle" | "connecting" | "ready" | "busy";

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function StatusRow({ icon, label, value, onLabel, offLabel }: { icon: string; label: string; value: boolean | null | undefined; onLabel: string; offLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-separator-secondary bg-background-primary px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-label-primary">
        <Icon name={icon} className="h-4 w-4 text-label-secondary" />
        {label}
      </div>
      <Tag variant={value == null ? "primary" : value ? "success" : "error"}>
        {value == null ? "Unknown" : value ? onLabel : offLabel}
      </Tag>
    </div>
  );
}

export default function DeviceSetup({ deviceId, deviceMode }: { deviceId: string; deviceMode: string }) {
  const supported = typeof navigator !== "undefined" && "serial" in navigator;

  const serialRef = useRef<DeviceSerial | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [schema, setSchema] = useState<SettingDef[]>([]);
  const [values, setValues] = useState<DeviceValues>({});
  const [draft, setDraft] = useState<Draft>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rebootRequired, setRebootRequired] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [port, setPort] = useState<SerialPort | null>(null);

  const handlers: DeviceSerialHandlers = {
    onLog: (line) => setLog((l) => appendLogLine(l, line)),
    onDisconnect: (serial) => {
      if (serialRef.current !== serial) return;
      serialRef.current = null;
      setPhase("idle");
      setInfo(null);
      setStatus(null);
      setError("Device disconnected.");
    },
  };

  useEffect(() => () => {
    const serial = serialRef.current;
    serialRef.current = null;
    void serial?.close();
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !serialRef.current) return;
    const interval = setInterval(async () => {
      if (phase !== "ready" || !serialRef.current) return;
      try {
        const nextStatus = await serialRef.current.status();
        setStatus(nextStatus);
      } catch (e) {
        console.error("Failed to poll status", e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  async function load(serial: DeviceSerial, deviceInfo: DeviceInfo) {
    serialRef.current = serial;
    const [nextSchema, nextValues, nextStatus] = await Promise.all([serial.schema(), serial.get(), serial.status()]);
    setInfo(deviceInfo);
    setSchema(nextSchema);
    setValues(nextValues);
    setDraft(draftFromValues(nextSchema, nextValues));
    setStatus(nextStatus);
    setFieldErrors({});
    setPhase("ready");
  }

  async function run(label: string, task: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusyLabel(label);
    setPhase(serialRef.current ? "busy" : "connecting");
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e, `${label} failed.`));
    } finally {
      setBusyLabel("");
      setPhase(serialRef.current ? "ready" : "idle");
    }
  }

  async function detach() {
    const serial = serialRef.current;
    serialRef.current = null;
    await serial?.close();
    return serial?.port ?? null;
  }

  async function waitForReboot(port: SerialPort) {
    setBusyLabel("Waiting for device to restart...");
    const { serial, info: deviceInfo } = await reconnectAfterReset(port, handlers);
    await load(serial, deviceInfo);
  }

  function handleConnect() {
    return run("Connecting...", async () => {
      const port = await navigator.serial.requestPort();
      setLog([]);
      setPort(port);
      const { serial, info: deviceInfo } = await connectDevice(port, handlers);
      await load(serial, deviceInfo);
    });
  }

  function handleDisconnect() {
    return run("Disconnecting...", async () => {
      await detach();
      setPort(null);
      setInfo(null);
      setStatus(null);
    });
  }

  function handleRefresh() {
    return run("Refreshing...", async () => {
      const serial = serialRef.current;
      if (!serial) return;
      const [nextValues, nextStatus] = await Promise.all([serial.get(), serial.status()]);
      setValues(nextValues);
      setDraft(draftFromValues(schema, nextValues));
      setStatus(nextStatus);
      setFieldErrors({});
    });
  }

  function handleSave() {
    const { changes, errors } = changedValues(schema, values, draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (!Object.keys(changes).length) {
      setNotice("Nothing to save.");
      return;
    }
    return run("Saving...", async () => {
      const serial = serialRef.current;
      if (!serial) return;
      try {
        const { rebootRequired: needsReboot } = await serial.set(changes);
        const nextValues = await serial.get();
        setValues(nextValues);
        setDraft(draftFromValues(schema, nextValues));
        setRebootRequired((r) => r || needsReboot);
        setNotice(needsReboot ? "Settings saved. Reboot the device to apply them." : "Settings saved.");
      } catch (e) {
        if (e instanceof DeviceRequestError && e.fields) setFieldErrors(e.fields);
        throw e;
      }
    });
  }

  function handleReboot() {
    return run("Rebooting...", async () => {
      await serialRef.current?.reboot();
      const port = await detach();
      setRebootRequired(false);
      if (port) await waitForReboot(port);
    });
  }


  function handleFillFromServer() {
    return run("Generating credentials...", async () => {
      const res = await fetch(`/api/devices/${deviceId}/token`, { method: "POST", headers: workspaceHeader() });
      if (!res.ok) throw new Error("Failed to generate MQTT credentials.");
      const { token } = await res.json();
      const known = new Set(schema.map((d) => d.key));
      const defaultMqttUrl = import.meta.env.VITE_PUBLIC_MQTT_URL;
      setDraft((d) => ({
        ...d,
        ...(known.has("mqtt_url") && defaultMqttUrl && { mqtt_url: defaultMqttUrl }),
        ...(known.has("mqtt_user") && { mqtt_user: token.mqttUser }),
        ...(known.has("mqtt_pass") && { mqtt_pass: token.mqttPass }),
        ...(known.has("mode") && deviceMode && { mode: deviceMode }),
      }));
      setNotice("MQTT credentials filled in. Save to write them to the device.");
    });
  }

  const connected = phase === "ready" || phase === "busy";
  const busy = phase === "busy" || phase === "connecting";

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-64 flex-1">
          <h3 className="font-display text-base font-bold text-label-primary">Setup Device</h3>
          <p className="mt-1 text-sm text-label-secondary">Connect over USB to view and change this device's settings.</p>
        </div>
        {connected && <Tag variant="success">Connected</Tag>}
      </div>

      {!supported ? (
        <p className="text-sm text-label-tertiary">
          Plug the device into this computer with a USB cable and open this page in Chrome or Edge on a desktop to set it up.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {notice && <p className="text-sm text-accent-primary">{notice}</p>}
          {busyLabel && <p className="text-sm text-label-tertiary">{busyLabel}</p>}

          {!port ? (
            <div>
              <Button tag="device_setup_connect" variant="ghost" size="md" icon="mdi:usb-port" onClick={handleConnect} disabled={busy}>
                {phase === "connecting" ? "Connecting..." : "Connect to Device"}
              </Button>
            </div>
          ) : (
            <>
              {connected && (
                <>
                  <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon name="mdi:list-status" className="h-4 w-4 text-label-secondary" />
                        <h4 className="font-display text-sm font-bold text-label-primary">Device Status</h4>
                      </div>
                      <Button tag="device_setup_check_status" variant="ghost" size="sm" icon="mdi:refresh" onClick={handleRefresh} disabled={busy}>Refresh</Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-separator-secondary bg-background-primary px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-label-primary">
                          <Icon name="mdi:chip" className="h-4 w-4 text-label-secondary" />
                          Firmware
                        </div>
                        <Tag variant="primary"><span className="font-mono">{info?.fw ?? "Unknown"}</span></Tag>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-separator-secondary bg-background-primary px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-label-primary">
                          <Icon name="mdi:identifier" className="h-4 w-4 text-label-secondary" />
                          MAC
                        </div>
                        <Tag variant="primary"><span className="font-mono">{info?.mac ?? "Unknown"}</span></Tag>
                      </div>
                      <StatusRow icon="mdi:wifi" label="WiFi" value={status?.wifi_connected} onLabel="Connected" offLabel="Disconnected" />
                      <StatusRow icon="mdi:server-network" label="MQTT" value={status?.mqtt_connected} onLabel="Connected" offLabel="Disconnected" />
                      <StatusRow icon="mdi:nfc" label="PN532 Reader" value={status?.nfc_reader_ok} onLabel="Connected" offLabel="Not Detected" />
                    </div>
                  </div>
    
                  <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon name="mdi:cog" className="h-4 w-4 text-label-secondary" />
                        <h4 className="font-display text-sm font-bold text-label-primary">Settings</h4>
                      </div>
                      <Button tag="device_setup_generate_mqtt_creds" variant="ghost" size="sm" icon="mdi:key-variant" onClick={handleFillFromServer} disabled={busy}>
                        Fill MQTT credentials
                      </Button>
                    </div>
                    <DeviceSettingsForm
                      schema={schema}
                      values={values}
                      draft={draft}
                      errors={fieldErrors}
                      disabled={busy}
                      onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button tag="device_setup_save" variant="primary" size="sm" icon="mdi:content-save" onClick={handleSave} disabled={busy}>Save</Button>
                      {rebootRequired && (
                        <Button tag="device_setup_reboot_to_apply" variant="primary" size="sm" icon="mdi:restart" onClick={handleReboot} disabled={busy}>Reboot to apply</Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="mdi:chip" className="h-4 w-4 text-label-secondary" />
                  <h4 className="font-display text-sm font-bold text-label-primary">Maintenance</h4>
                </div>
                <p className="text-sm text-label-secondary">{connected || phase === "connecting" ? "Restart the device." : "The device doesn't respond to setup commands."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button tag="device_setup_reboot" variant="ghost" size="sm" icon="mdi:restart" onClick={handleReboot} disabled={busy || !connected}>Reboot</Button>
                </div>
              </div>

              <div>
                <Button tag="device_setup_disconnect" variant="ghost" size="sm" icon="mdi:close" onClick={handleDisconnect} disabled={busy}>Disconnect</Button>
              </div>
            </>
          )}

          {log.length > 0 && (
            <details className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
              <summary className="cursor-pointer text-sm font-bold text-label-primary">Device log ({log.length})</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-label-secondary">{log.join("\n")}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
