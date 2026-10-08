import { useEffect, useState } from "react";
import { env } from "@/lib/env";

type Check = { ok: boolean; error?: string };
type BackendService = { commit: string; db: Check; mqtt: Check };

const firmwareCommit = env.firmwareFile.match(/^prismo-firmware-(.+)\.bin$/)?.[1];

function Row({ label, value, check }: { label: string; value?: string; check?: Check }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-separator-secondary py-3 last:border-b-0">
      <span className="text-sm text-label-secondary">{label}</span>
      {check ? (
        <span className={`font-mono text-sm ${check.ok ? "text-status-success" : "text-status-error"}`}>
          {check.ok ? "ok" : `error${check.error ? `: ${check.error}` : ""}`}
        </span>
      ) : (
        <span className="font-mono text-sm text-label-primary">{value || "unknown"}</span>
      )}
    </div>
  );
}

export default function ServicePage() {
  const [backend, setBackend] = useState<BackendService | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/service")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setBackend)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="mx-auto max-w-xl p-4 md:p-8">
      <h1 className="mb-4 font-display text-2xl font-bold text-label-primary">Service</h1>
      <div className="rounded-2xl border border-separator-secondary bg-fill-tertiary px-4 md:px-6">
        <Row label="Client commit" value={env.commitSha} />
        <Row label="Firmware commit" value={firmwareCommit} />
        <Row label="Backend commit" value={backend?.commit ?? (error ? `unreachable: ${error}` : "loading...")} />
        {backend && <Row label="Database" check={backend.db} />}
        {backend && <Row label="MQTT" check={backend.mqtt} />}
      </div>
    </div>
  );
}
