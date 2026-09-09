import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { devicesCol, ObjectId } from "@/lib/server/db";
import { listOrgKeys, deleteOrgKey } from "@/lib/keys/server/key-service";

export async function GET() {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = new ObjectId(user.id);
  const [keysData, devicesData] = await Promise.all([
    listOrgKeys(user.id),
    devicesCol.find({ ownerId }).sort({ createdAt: 1 }).toArray(),
  ]);

  const devices = devicesData.map((d) => ({ deviceSlug: d.deviceSlug, name: d.name }));
  return NextResponse.json({ keys: keysData, devices });
}

export async function DELETE(req: Request) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { keyId } = await req.json();
  if (!keyId) return NextResponse.json({ error: "Missing keyId" }, { status: 400 });

  await deleteOrgKey(user.id, keyId);
  return NextResponse.json({ success: true });
}
