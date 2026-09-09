import { NextRequest, NextResponse } from "next/server";
import { usersCol } from "@/lib/server/db";
import { createSession } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const { googleAccessToken } = await req.json();
    if (!googleAccessToken) {
      return NextResponse.json({ error: "Missing googleAccessToken" }, { status: 400 });
    }

    const url = new URL('https://www.googleapis.com/oauth2/v3/userinfo');
    url.searchParams.append('access_token', googleAccessToken);

    const userInfoResponse = await fetch(url.toString());
    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      return NextResponse.json({
        error: userInfo.error_description || "Invalid access token"
      }, { status: 401 });
    }

    const { sub: googleId, email, name } = userInfo;

    if (!googleId || !email || !name) {
      return NextResponse.json({
        error: "Incomplete user profile from Google",
      }, { status: 400 });
    }

    // Upsert user in Mongo
    let user = await usersCol.findOne({ googleId });
    if (!user) {
      // Create user
      const result = await usersCol.insertOne({
        googleId,
        name,
        email,
        sessions: [],
        createdAt: new Date(),
      });
      user = await usersCol.findOne({ _id: result.insertedId });
    }

    if (!user) {
      throw new Error("Failed to create or fetch user");
    }

    // Create session token
    const token = await createSession(user._id!.toHexString());

    const response = NextResponse.json({ success: true });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
