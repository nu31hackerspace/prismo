"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { formatDate } from "@/lib/utils";

const ONLINE_THRESHOLD_MS = 10_000;

function isOnline(lastSeenAt: number | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt < ONLINE_THRESHOLD_MS;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices);
      }
    } catch (err) {
      console.error("Failed to fetch devices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleAddDevice = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name")?.toString().trim();
    const mode = formData.get("mode")?.toString();

    if (!name || !mode) return;

    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mode }),
      });
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        fetchDevices();
      }
    } catch (err) {
      console.error("Failed to add device", err);
    }
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
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="text-left">
            <h1 className="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
              My Devices
            </h1>
            <p className="mt-2 text-label-secondary">Manage your Prismo devices and generate API tokens.</p>
          </div>

          <form onSubmit={handleAddDevice} className="flex flex-wrap gap-2">
            <input
              type="text"
              name="name"
              placeholder="Device name (e.g. Front Door)"
              required
              className="w-64 rounded-xl border border-separator-secondary bg-fill-tertiary px-4 py-2 text-label-primary outline-none focus:border-accent-primary sm:w-80"
            />
            <select
              name="mode"
              className="rounded-xl border border-separator-secondary bg-fill-tertiary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
            >
              <option value="door">Door Lock</option>
              <option value="machine">Machine Access</option>
            </select>
            <Button type="submit" variant="primary" size="md" icon="mdi:plus">
              Add Device
            </Button>
          </form>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><span className="text-label-secondary">Loading...</span></div>
        ) : devices && devices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="group relative flex flex-col rounded-2xl border border-separator-secondary bg-fill-tertiary p-6 transition-all hover:border-separator-primary hover:shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-xl bg-background-primary p-3 text-label-secondary transition-colors group-hover:text-accent-primary">
                    <Icon name="mdi:chip" className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag
                      variant={isOnline(device.lastSeenAt) ? "success" : "error"}
                    >
                      {isOnline(device.lastSeenAt) ? "Online" : "Offline"}
                    </Tag>
                    <span className="text-xs text-label-tertiary">
                      {new Date(device.createdAt).toISOString().split("T")[0]}
                    </span>
                  </div>
                </div>

                <h3 className="mb-1 font-display text-xl font-bold text-label-primary">{device.name}</h3>
                <p className="mb-6 flex-grow font-mono text-xs text-label-tertiary">
                  {device.deviceSlug}
                </p>

                <Button
                  href={`/devices/${device.deviceSlug}`}
                  variant="ghost"
                  size="md"
                  icon="mdi:cog"
                >
                  Manage
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20">
            <Icon name="mdi:chip" className="mb-4 h-12 w-12 text-label-tertiary" />
            <p className="text-label-secondary">No devices found. Add your first device to get started.</p>
          </div>
        )}
      </div>
    </section>
  );
}
