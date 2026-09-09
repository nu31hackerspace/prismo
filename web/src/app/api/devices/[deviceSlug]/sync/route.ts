import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { forceSyncDevice } from "@/lib/devices/server/device-service";

export async function POST(req: Request, { params }: { params: Promise<{ deviceSlug: string }> }) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { deviceSlug } = await params;
  await forceSyncDevice(deviceSlug, user.id);
  return NextResponse.json({ success: true });
}
