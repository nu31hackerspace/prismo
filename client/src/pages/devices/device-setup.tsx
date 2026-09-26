import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { flashFirmware, patchDeviceConfig, readDeviceState } from "@/client/flasher";
import { workspaceHeader } from "@/store/workspace-id";

type SendState = "idle" | "sending" | "success";

type DeviceStatus = {
  wifiConnected: boolean;
  mqttConnected: boolean;
  nfcOk: boolean | null;
  firmwareVersion: string;
};

function StatusRow({ icon, label, value, onLabel, offLabel }: { icon: string; label: string; value: boolean | null; onLabel: string; offLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-separator-secondary bg-background-primary px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-label-primary">
        <Icon name={icon} className="h-4 w-4 text-label-secondary" />
        {label}
      </div>
      <Tag variant={value === null ? "primary" : value ? "success" : "error"}>
        {value === null ? "Unknown" : value ? onLabel : offLabel}
      </Tag>
    </div>
  );
}

export default function DeviceSetup({ deviceId, deviceMode }: { deviceId: string; deviceMode: string }) {
  const supported = typeof navigator !== "undefined" && "serial" in navigator;

  const [port, setPort] = useState<SerialPort | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [flashState, setFlashState] = useState<SendState>("idle");
  const [flashProgress, setFlashProgress] = useState("");
  const [flashError, setFlashError] = useState("");

  const [ssid, setSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiState, setWifiState] = useState<SendState>("idle");
  const [wifiProgress, setWifiProgress] = useState("");
  const [wifiError, setWifiError] = useState("");

  const [mqttUrl, setMqttUrl] = useState("");
  const [mqttUser, setMqttUser] = useState("");
  const [mqttPass, setMqttPass] = useState("");
  const [mode, setMode] = useState(deviceMode || "door");
  const [generatingCreds, setGeneratingCreds] = useState(false);
  const [mqttState, setMqttState] = useState<SendState>("idle");
  const [mqttProgress, setMqttProgress] = useState("");
  const [mqttError, setMqttError] = useState("");

  async function handleConnect() {
    setConnectError("");
    setConnecting(true);
    try {
      const p = await navigator.serial.requestPort();
      setPort(p);
      await handleCheckStatus(p);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Failed to connect to device.");
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    setPort(null);
    setFlashState("idle");
    setWifiState("idle");
    setMqttState("idle");
    setStatus(null);
    setStatusError("");
  }

  async function handleCheckStatus(targetPort?: SerialPort) {
    const p = targetPort ?? port;
    if (!p) return;
    setStatusError("");
    setStatusLoading(true);
    try {
      const state = await readDeviceState(p);
      if (!state) throw new Error("No response from device — is it running Prismo firmware?");
      setStatus({
        wifiConnected: !!state.wifi_connected,
        mqttConnected: !!state.mqtt_connected,
        nfcOk: state.nfc_reader_ok ?? null,
        firmwareVersion: state.git_commit ?? "unknown",
      });
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to read device status.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleFlash() {
    if (!port) return;
    setFlashError("");
    setFlashState("sending");
    try {
      await flashFirmware(port, "/firmware.bin", setFlashProgress);
      setFlashState("success");
    } catch (e) {
      setFlashError(e instanceof Error ? e.message : "Failed to flash firmware.");
      setFlashState("idle");
    } finally {
      setFlashProgress("");
    }
  }

  async function handleSendWifi() {
    if (!port) return;
    if (!ssid.trim() || !wifiPassword) {
      setWifiError("Enter the WiFi SSID and password.");
      return;
    }
    setWifiError("");
    setWifiState("sending");
    try {
      await patchDeviceConfig(port, { wifi_ssid: ssid.trim(), wifi_pass: wifiPassword }, setWifiProgress);
      setWifiState("success");
    } catch (e) {
      setWifiError(e instanceof Error ? e.message : "Failed to update WiFi.");
      setWifiState("idle");
    } finally {
      setWifiProgress("");
    }
  }

  async function handleGenerateCredentials() {
    setMqttError("");
    setGeneratingCreds(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/token`, { method: "POST", headers: workspaceHeader() });
      if (!res.ok) throw new Error("Failed to generate MQTT credentials.");
      const { token } = await res.json();
      setMqttUser(token.mqttUser);
      setMqttPass(token.mqttPass);
    } catch (e) {
      setMqttError(e instanceof Error ? e.message : "Failed to generate MQTT credentials.");
    } finally {
      setGeneratingCreds(false);
    }
  }

  async function handleSendMqtt() {
    if (!port) return;
    if (!mqttUrl.trim() || !mqttUser.trim() || !mqttPass) {
      setMqttError("Enter the MQTT host, user and password.");
      return;
    }
    setMqttError("");
    setMqttState("sending");
    try {
      await patchDeviceConfig(port, {
        mqtt_url: mqttUrl.trim(),
        mqtt_user: mqttUser.trim(),
        mqtt_pass: mqttPass,
        mode,
      }, setMqttProgress);
      setMqttState("success");
    } catch (e) {
      setMqttError(e instanceof Error ? e.message : "Failed to update MQTT configuration.");
      setMqttState("idle");
    } finally {
      setMqttProgress("");
    }
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-64 flex-1">
          <h3 className="font-display text-base font-bold text-label-primary">Setup Device</h3>
          <p className="mt-1 text-sm text-label-secondary">Connect over USB to configure WiFi and MQTT on this device.</p>
        </div>
        {port && <Tag variant="success">Connected</Tag>}
      </div>

      {!supported ? (
        <p className="text-sm text-label-tertiary">
          Plug the device into this computer with a USB cable and open this page in Chrome or Edge on a desktop to set it up.
        </p>
      ) : !port ? (
        <>
          {connectError && <p className="mb-3 text-sm text-red-500">{connectError}</p>}
          <Button tag="device_setup_connect" variant="ghost" size="md" icon="mdi:usb-port" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Connecting..." : "Connect to Device"}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="mdi:list-status" className="h-4 w-4 text-label-secondary" />
                <h4 className="font-display text-sm font-bold text-label-primary">Device Status</h4>
              </div>
              <Button tag="device_setup_check_status" variant="ghost" size="sm" icon="mdi:refresh" onClick={() => handleCheckStatus()} disabled={statusLoading}>
                {statusLoading ? "Checking..." : "Refresh"}
              </Button>
            </div>
            {statusError && <p className="mb-2 text-sm text-red-500">{statusError}</p>}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-separator-secondary bg-background-primary px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-label-primary">
                  <Icon name="mdi:chip" className="h-4 w-4 text-label-secondary" />
                  Firmware
                </div>
                <Tag variant="primary"><span className="font-mono">{status ? status.firmwareVersion : "Unknown"}</span></Tag>
              </div>
              <StatusRow icon="mdi:wifi" label="WiFi" value={status ? status.wifiConnected : null} onLabel="Connected" offLabel="Disconnected" />
              <StatusRow icon="mdi:server-network" label="MQTT" value={status ? status.mqttConnected : null} onLabel="Connected" offLabel="Disconnected" />
              <StatusRow icon="mdi:nfc" label="PN532 Reader" value={status ? status.nfcOk : null} onLabel="Connected" offLabel="Not Detected" />
            </div>
          </div>

          <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="mdi:chip" className="h-4 w-4 text-label-secondary" />
              <h4 className="font-display text-sm font-bold text-label-primary">Firmware</h4>
            </div>
            <p className="text-sm text-label-secondary">Upload the latest Prismo firmware to the connected ESP32-C3.</p>
            {flashState === "sending" && flashProgress && <p className="mt-2 text-sm text-label-tertiary">{flashProgress}</p>}
            {flashError && <p className="mt-2 text-sm text-red-500">{flashError}</p>}
            {flashState === "success" && <p className="mt-2 text-sm text-accent-primary">Firmware flashed — the device is rebooting.</p>}
            <div className="mt-3">
              <Button tag="device_setup_flash" variant="primary" size="sm" icon="mdi:flash" onClick={handleFlash} disabled={flashState === "sending"}>
                {flashState === "sending" ? "Flashing..." : "Flash Device"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="mdi:wifi-cog" className="h-4 w-4 text-label-secondary" />
              <h4 className="font-display text-sm font-bold text-label-primary">WiFi Credentials</h4>
            </div>
            <div className="flex flex-wrap gap-3">
              <input type="text" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="WiFi SSID" className="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary" />
              <div className="relative min-w-32 flex-1">
                <input type={showWifiPassword ? "text" : "password"} value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="WiFi Password" className="w-full rounded-xl border border-separator-secondary bg-background-primary py-2 pr-10 pl-3 text-sm text-label-primary outline-none focus:border-accent-primary" />
                <Button tag="device_setup_wifi_toggle_password_visibility" variant="ghost" size="sm" onClick={() => setShowWifiPassword(!showWifiPassword)} icon={showWifiPassword ? "mdi:eye-off" : "mdi:eye"} className="absolute inset-y-0 right-0 w-10 text-label-secondary hover:bg-transparent hover:text-label-primary" />
              </div>
            </div>
            {wifiState === "sending" && wifiProgress && <p className="mt-2 text-sm text-label-tertiary">{wifiProgress}</p>}
            {wifiError && <p className="mt-2 text-sm text-red-500">{wifiError}</p>}
            {wifiState === "success" && <p className="mt-2 text-sm text-accent-primary">WiFi updated — the device is reconnecting.</p>}
            <div className="mt-3">
              <Button tag="device_setup_send_wifi" variant="primary" size="sm" icon="mdi:send" onClick={handleSendWifi} disabled={wifiState === "sending"}>
                {wifiState === "sending" ? "Sending..." : "Send WiFi Credentials"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-separator-secondary bg-fill-tertiary p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="mdi:server-network" className="h-4 w-4 text-label-secondary" />
              <h4 className="font-display text-sm font-bold text-label-primary">MQTT & Mode</h4>
            </div>
            <div className="flex flex-wrap gap-3">
              <input type="text" value={mqttUrl} onChange={(e) => setMqttUrl(e.target.value)} placeholder="mqtts://host:8883" className="min-w-48 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary" />
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary">
                <option value="door">Door</option>
                <option value="machine">Machine</option>
              </select>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <input type="text" value={mqttUser} onChange={(e) => setMqttUser(e.target.value)} placeholder="MQTT User" className="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 font-mono text-xs text-label-primary outline-none focus:border-accent-primary" />
              <input type="text" value={mqttPass} onChange={(e) => setMqttPass(e.target.value)} placeholder="MQTT Password" className="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 font-mono text-xs text-label-primary outline-none focus:border-accent-primary" />
              <Button tag="device_setup_generate_mqtt_creds" variant="ghost" size="sm" icon="mdi:refresh" onClick={handleGenerateCredentials} disabled={generatingCreds}>
                {generatingCreds ? "Generating..." : "Generate New"}
              </Button>
            </div>
            {mqttState === "sending" && mqttProgress && <p className="mt-2 text-sm text-label-tertiary">{mqttProgress}</p>}
            {mqttError && <p className="mt-2 text-sm text-red-500">{mqttError}</p>}
            {mqttState === "success" && <p className="mt-2 text-sm text-accent-primary">MQTT configuration updated — the device is reconnecting.</p>}
            <div className="mt-3">
              <Button tag="device_setup_send_mqtt" variant="primary" size="sm" icon="mdi:send" onClick={handleSendMqtt} disabled={mqttState === "sending"}>
                {mqttState === "sending" ? "Sending..." : "Send MQTT Configuration"}
              </Button>
            </div>
          </div>

          <div>
            <Button tag="device_setup_disconnect" variant="ghost" size="sm" icon="mdi:close" onClick={handleDisconnect}>Disconnect</Button>
          </div>
        </div>
      )}
    </div>
  );
}
