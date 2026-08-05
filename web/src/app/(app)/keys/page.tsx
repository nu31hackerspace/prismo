import { getUser } from '@/lib/server/auth-utils';
import { devicesCol, ObjectId } from '@/lib/server/db';
import { listOrgKeys, deleteOrgKey, attachKeyToDevice } from '@/lib/keys/server/key-service';
import { removeKeyFromDevice } from '@/lib/devices/server/device-service';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import MainButton from '@/components/MainButton';
import { Icon } from '@iconify/react';
import Link from 'next/link';

export default async function KeysPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const ownerId = new ObjectId(user.id);

  const [keys, devices] = await Promise.all([
    listOrgKeys(user.id),
    devicesCol.find({ ownerId }).sort({ createdAt: 1 }).toArray()
  ]);

  const devicesData = devices.map((d) => ({ deviceSlug: d.deviceSlug, name: d.name }));

  function devicesNotAttached(attached: { deviceSlug: string }[]) {
    const attachedSet = new Set(attached.map((d) => d.deviceSlug));
    return devicesData.filter((d) => !attachedSet.has(d.deviceSlug));
  }

  async function attachDeviceAction(formData: FormData) {
    'use server';
    const currentUser = await getUser();
    if (!currentUser) throw new Error('Unauthorized');
    const keyId = formData.get('keyId') as string;
    const deviceSlug = formData.get('deviceSlug') as string;
    if (!keyId || !deviceSlug) throw new Error('keyId and deviceSlug are required');
    await attachKeyToDevice(currentUser.id, keyId, deviceSlug);
    revalidatePath('/keys');
  }

  async function detachDeviceAction(formData: FormData) {
    'use server';
    const currentUser = await getUser();
    if (!currentUser) throw new Error('Unauthorized');
    const keyId = formData.get('keyId') as string;
    const deviceSlug = formData.get('deviceSlug') as string;
    if (!keyId || !deviceSlug) throw new Error('keyId and deviceSlug are required');
    await removeKeyFromDevice(deviceSlug, currentUser.id, keyId);
    revalidatePath('/keys');
  }

  async function deleteKeyAction(formData: FormData) {
    'use server';
    const currentUser = await getUser();
    if (!currentUser) throw new Error('Unauthorized');
    const keyId = formData.get('keyId') as string;
    if (!keyId) throw new Error('keyId is required');
    await deleteOrgKey(currentUser.id, keyId);
    revalidatePath('/keys');
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
        <div className="mb-12 text-left">
          <h1 className="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
            Keys
          </h1>
          <p className="mt-2 text-label-secondary">
            Every NFC key you've named appears here. Attach it to any locker, or revoke it everywhere at once.
          </p>
        </div>

        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20">
            <Icon icon="mdi:key-outline" className="mb-4 h-12 w-12 text-label-tertiary" />
            <p className="text-label-secondary">
              No keys yet. Scan an unknown card on any device page and give it a name.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map((key) => {
              const candidateDevices = devicesNotAttached(key.devices);
              return (
                <div
                  key={key.keyId}
                  data-key-id={key.keyId}
                  className="flex flex-col justify-between rounded-2xl border border-separator-secondary bg-fill-tertiary p-6"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-label-primary">{key.name}</div>
                      <div className="mt-2 font-mono text-xs break-all text-label-tertiary">{key.keyId}</div>
                    </div>
                    <form action={deleteKeyAction} onSubmit={(e) => {
                      if (!confirm(`Delete "${key.name}"? This revokes access from every device.`)) {
                        e.preventDefault();
                      }
                    }}>
                      <input type="hidden" name="keyId" value={key.keyId} />
                      <MainButton size="S" buttonStyle="ghost" icon="mdi:delete-outline" label="Delete" />
                    </form>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold tracking-wide text-label-tertiary uppercase">
                      Devices ({key.devices.length})
                    </div>
                    {key.devices.length === 0 ? (
                      <p className="mb-3 text-sm text-label-tertiary">Not attached to any device yet.</p>
                    ) : (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {key.devices.map((device) => (
                          <div
                            key={device.deviceSlug}
                            className="flex items-center gap-2 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2"
                          >
                            <Link
                              href={`/devices/${device.deviceSlug}`}
                              className="text-sm font-semibold text-label-primary hover:underline"
                            >
                              {device.name}
                            </Link>
                            <form action={detachDeviceAction}>
                              <input type="hidden" name="keyId" value={key.keyId} />
                              <input type="hidden" name="deviceSlug" value={device.deviceSlug} />
                              <button
                                type="submit"
                                aria-label="Detach"
                                className="text-label-tertiary transition-colors hover:text-label-primary"
                              >
                                <Icon icon="mdi:close" className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}

                    {candidateDevices.length > 0 && (
                      <form action={attachDeviceAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="keyId" value={key.keyId} />
                        <select
                          name="deviceSlug"
                          required
                          aria-label="Add to device"
                          className="min-w-0 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
                          defaultValue=""
                        >
                          <option value="" disabled>Attach to device…</option>
                          {candidateDevices.map((device) => (
                            <option key={device.deviceSlug} value={device.deviceSlug}>
                              {device.name}
                            </option>
                          ))}
                        </select>
                        <MainButton size="S" buttonStyle="primary" icon="mdi:plus" label="Add" />
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
