import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { devicesCol, ObjectId } from "@/lib/server/db";
import { createDevice } from "@/lib/devices/server/device-service";

export async function GET() {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userDevices = await devicesCol.find({ ownerId: new ObjectId(user.id) }).toArray();
  const devices = userDevices.map(({ _id, name, deviceSlug, createdAt, lastSeenAt }) => ({
    id: _id!.toHexString(),
    name,
    deviceSlug,
    createdAt: createdAt.getTime(),
    lastSeenAt: lastSeenAt ? lastSeenAt.getTime() : null,
  }));

  return NextResponse.json({ devices });
}

export async function POST(req: Request) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, mode } = body;
  
  if (!name || !mode) return NextResponse.json({ error: "Missing name or mode" }, { status: 400 });

  await createDevice(user.id, name, mode);
  return NextResponse.json({ success: true });
}
