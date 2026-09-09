import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { removeKeyFromDevice } from "@/lib/devices/server/device-service";

export async function POST(req: Request) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { keyId, deviceSlug } = await req.json();
  if (!keyId || !deviceSlug) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  await removeKeyFromDevice(deviceSlug, user.id, keyId);
  return NextResponse.json({ success: true });
}
