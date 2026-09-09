import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { addKeyToDevice, removeKeyFromDevice } from "@/lib/devices/server/device-service";

export async function POST(req: Request, { params }: { params: Promise<{ deviceSlug: string }> }) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { deviceSlug } = await params;
  const { keyId, name } = await req.json();
  if (!keyId) return NextResponse.json({ error: "Missing keyId" }, { status: 400 });

  await addKeyToDevice(deviceSlug, user.id, keyId, name);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ deviceSlug: string }> }) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { deviceSlug } = await params;
  const { keyId } = await req.json();
  if (!keyId) return NextResponse.json({ error: "Missing keyId" }, { status: 400 });

  await removeKeyFromDevice(deviceSlug, user.id, keyId);
  return NextResponse.json({ success: true });
}
