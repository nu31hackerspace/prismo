import { getUser } from '@/lib/server/auth-utils';
import { devicesCol, ObjectId } from '@/lib/server/db';
import { createDevice } from '@/lib/devices/server/device-service';
import { redirect } from 'next/navigation';
import MainButton from '@/components/MainButton';
import Badge from '@/components/Badge';
import { Icon } from '@iconify/react';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

const ONLINE_THRESHOLD_MS = 10_000;

function isOnline(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export default async function DevicesPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const userDevices = await devicesCol.find({ ownerId: new ObjectId(user.id) }).toArray();

  const devices = userDevices.map(({ _id, ownerId, name, deviceSlug, createdAt, lastSeenAt }) => ({
    id: _id!.toHexString(),
    ownerId: ownerId.toHexString(),
    name,
    deviceSlug,
    createdAt: createdAt.getTime(),
    lastSeenAt: lastSeenAt ? lastSeenAt.getTime() : null,
  }));

  async function addDevice(formData: FormData) {
    'use server';
    const currentUser = await getUser();
    if (!currentUser) throw new Error('Unauthorized');

    const name = formData.get('name') as string;
    const modeRaw = formData.get('mode') as string;
    const mode = modeRaw === 'machine' ? 'machine' : 'door';

    if (!name) {
      throw new Error('Name is required');
    }

    await createDevice(currentUser.id, name, mode);
    revalidatePath('/devices');
  }

  return (
    <section className="relative overflow-hidden pt-10 pb-20 md:pt-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
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

          <form action={addDevice} className="flex flex-wrap gap-2">
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
            <MainButton label="Add Device" icon="mdi:plus" buttonStyle="primary" size="M" />
          </form>
        </div>

        {devices && devices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="group relative flex flex-col rounded-2xl border border-separator-secondary bg-fill-tertiary p-6 transition-all hover:border-separator-primary hover:shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-xl bg-background-primary p-3 text-label-secondary transition-colors group-hover:text-accent-primary">
                    <Icon icon="mdi:chip" className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      label={isOnline(device.lastSeenAt ? new Date(device.lastSeenAt) : null) ? 'Online' : 'Offline'}
                      variant={isOnline(device.lastSeenAt ? new Date(device.lastSeenAt) : null) ? 'success' : 'error'}
                    />
                    <span className="text-xs text-label-tertiary">
                      {new Date(device.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <h3 className="mb-1 font-display text-xl font-bold text-label-primary">{device.name}</h3>
                <p className="mb-6 flex-grow font-mono text-xs text-label-tertiary">
                  {device.deviceSlug}
                </p>

                <MainButton
                  label="Manage"
                  icon="mdi:cog"
                  buttonStyle="secondary"
                  size="M"
                  link={`/devices/${device.deviceSlug}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20">
            <Icon icon="mdi:chip" className="mb-4 h-12 w-12 text-label-tertiary" />
            <p className="text-label-secondary">No devices found. Add your first device to get started.</p>
          </div>
        )}
      </div>
    </section>
  );
}
