import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { useStore } from "@/store/provider";
import { draft } from "@/store/models/base";
import { trackEvent } from "@/lib/analytics";

export default observer(function DevicesPage() {
  const store = useStore();
  const [newName, setNewName] = useState("");

  const handleAddDevice = () => {
    const name = newName.trim();
    if (!name) return;

    // Created locally first: draft() puts it straight into the store (the
    // card below renders immediately) and queues it to reach the backend.
    draft(store.entities, "device", { name, mode: "door", modeParams: {}, lastSeenAt: null }).save();
    setNewName("");
  };

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
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="text-left">
            <h1 className="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
              My Devices
            </h1>
            <p className="mt-2 text-label-secondary">
              Manage your Prismo devices and generate API tokens.
              {store.workspace && <span className="text-label-tertiary"> · {store.workspace.name}</span>}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Device name (e.g. Front Door)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-64 rounded-xl border border-separator-secondary bg-fill-tertiary px-4 py-2 text-label-primary outline-none focus:border-accent-primary sm:w-80"
            />
            <Button tag="device_add" variant="primary" size="md" icon="mdi:plus" onClick={handleAddDevice}>
              Add Device
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><span className="text-label-secondary">Loading...</span></div>
        ) : devices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <Link
                key={device.id}
                to={`/devices/${device.id}`}
                onClick={() => trackEvent("click_device_card")}
                className="group relative flex flex-col rounded-2xl border border-separator-secondary bg-fill-tertiary p-6 transition-all hover:border-separator-primary hover:shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-xl bg-background-primary p-3 text-label-secondary transition-colors group-hover:text-accent-primary">
                    <Icon name="mdi:chip" className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag
                      variant={device.online ? "success" : "error"}
                    >
                      {device.online ? "Online" : "Offline"}
                    </Tag>
                  </div>
                </div>

                <h3 className="mb-1 font-display text-xl font-bold text-label-primary">{device.name}</h3>
                <p className="mb-6 flex-grow font-mono text-xs text-label-tertiary">
                  {device.id}
                </p>

                <span className="inline-flex h-12 items-center gap-2 rounded-md px-5 text-base font-medium text-label-primary transition-colors group-hover:bg-fill-secondary">
                  <Icon name="mdi:cog" className="h-5 w-5" />
                  Manage
                </span>
              </Link>
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
});
