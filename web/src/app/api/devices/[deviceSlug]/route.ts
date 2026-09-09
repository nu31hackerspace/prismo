import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { devicesCol, keysCol, deviceHistoryCol, deviceKeysCol, ObjectId } from "@/lib/server/db";
import { deleteDevice } from "@/lib/devices/server/device-service";

export async function GET(req: Request, { params }: { params: Promise<{ deviceSlug: string }> }) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceSlug } = await params;
  const ownerId = new ObjectId(user.id);
  const device = await devicesCol.findOne({ ownerId, deviceSlug });
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deviceKeys = await deviceKeysCol.find({ deviceId: device._id }).toArray();
  
  const history = await deviceHistoryCol.find({ deviceSlug }).sort({ createdAt: -1 }).limit(10).toArray();
  const [lastUnknownScan] = await deviceHistoryCol.find({ deviceSlug, action: "unauthorized" as any }).sort({ createdAt: -1 }).limit(1).toArray();

  const nameByKeyId = new Map(
    deviceKeys.length > 0
      ? (await keysCol.find({ ownerId, keyId: { $in: deviceKeys.map(k => k.keyId) } }).toArray()).map(k => [k.keyId, k.name])
      : []
  );

  const keys = deviceKeys.map(k => ({
    keyId: k.keyId,
    name: nameByKeyId.get(k.keyId) ?? '',
    addedAt: k.addedAt.getTime()
  }));

  const historyItems = history.map(h => ({
    id: h._id!.toHexString(),
    action: h.action,
    keyId: h.keyId ?? null,
    username: h.username ?? null,
    allowed: h.allowed ?? null,
    triggerAction: h.triggerAction ?? null,
    createdAt: h.createdAt.getTime()
  }));

  const lastUnauth = lastUnknownScan ? { keyId: lastUnknownScan.keyId!, createdAt: lastUnknownScan.createdAt.getTime() } : null;

  return NextResponse.json({ device, keys, historyItems, lastUnauth });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ deviceSlug: string }> }) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { deviceSlug } = await params;
  await deleteDevice(deviceSlug, user.id);
  return NextResponse.json({ success: true });
}
