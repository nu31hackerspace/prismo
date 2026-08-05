import { getUser } from '@/lib/server/auth-utils';
import { devicesCol, deviceKeysCol, deviceHistoryCol, keysCol, ObjectId } from '@/lib/server/db';
import { notFound, redirect } from 'next/navigation';
import DeviceClientView from './DeviceClientView';

interface PageProps {
  params: Promise<{ deviceSlug: string }>;
}

export default async function DevicePage({ params }: PageProps) {
  const { deviceSlug } = await params;
  
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const device = await devicesCol.findOne({
    deviceSlug,
    ownerId: new ObjectId(user.id)
  });
  
  if (!device) {
    notFound();
  }

  const deviceId = device._id!;
  const ownerId = device.ownerId;

  const orgKeys = await keysCol.find({ ownerId }, { projection: { keyId: 1 } }).toArray();
  const orgKeyIds = orgKeys.map(k => k.keyId);

  const [deviceKeys, history, lastUnknownScan] = await Promise.all([
    deviceKeysCol.find({ deviceId }).toArray(),
    deviceHistoryCol.find({ deviceId }).sort({ createdAt: -1 }).limit(50).toArray(),
    deviceHistoryCol.findOne(
      { deviceId, action: 'scan', keyId: { $exists: true, $nin: orgKeyIds } },
      { sort: { createdAt: -1 } }
    )
  ]);

  const nameByKeyId = new Map(
    deviceKeys.length > 0
      ? (
          await keysCol.find({ ownerId, keyId: { $in: deviceKeys.map((k) => k.keyId) } }).toArray()
        ).map((k) => [k.keyId, k.name])
      : []
  );

  const deviceData = {
    id: deviceId.toHexString(),
    name: device.name,
    deviceSlug: device.deviceSlug,
    lastSeenAt: device.lastSeenAt ? device.lastSeenAt.getTime() : null,
    mode: device.mode ?? 'door',
    modeParams: device.modeParams ?? {}
  };

  const keysData = deviceKeys.map((k) => ({
    keyId: k.keyId,
    name: nameByKeyId.get(k.keyId) ?? '',
    addedAt: k.addedAt.getTime()
  }));

  const historyData = history.map((h) => ({
    id: h._id!.toHexString(),
    action: h.action,
    keyId: h.keyId ?? null,
    username: h.username ?? null,
    allowed: h.allowed ?? null,
    triggerAction: h.triggerAction ?? null,
    createdAt: h.createdAt.getTime()
  }));

  const lastUnauthData = lastUnknownScan && lastUnknownScan.keyId
    ? { keyId: lastUnknownScan.keyId, createdAt: lastUnknownScan.createdAt.getTime() }
    : null;

  return (
    <DeviceClientView 
      device={deviceData} 
      keys={keysData} 
      history={historyData} 
      lastUnauth={lastUnauthData} 
    />
  );
}
