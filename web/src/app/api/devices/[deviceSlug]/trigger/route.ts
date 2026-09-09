import { NextResponse } from "next/server";
import { getUserFromServer } from "@/lib/server/auth";
import { triggerDevice } from "@/lib/devices/server/device-service";

export async function POST(req: Request, { params }: { params: Promise<{ deviceSlug: string }> }) {
  const user = await getUserFromServer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { deviceSlug } = await params;
  const { action } = await req.json();
  
  await triggerDevice(deviceSlug, user.id, action);
  return NextResponse.json({ success: true });
}
