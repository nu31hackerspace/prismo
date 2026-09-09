import { NextRequest, NextResponse } from "next/server";
import { invalidateSession, SESSION_COOKIE } from "@/lib/server/auth";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const secret = process.env.SESSION_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret) as { userId: string; sessionId: string };
        await invalidateSession(decoded.userId, decoded.sessionId);
      }
    } catch {
      // Ignore token verification errors during logout
    }
  }

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.delete(SESSION_COOKIE);

  return response;
}
