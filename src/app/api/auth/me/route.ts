import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession, refreshSession } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ user: null });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const nextExpiry = await refreshSession(token);
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
      musicVolume: Number(user.musicVolume ?? 0.45),
      sfxVolume: Number(user.sfxVolume ?? 0.55),
      chatPositionX: user.chatPositionX ?? null,
      chatPositionY: user.chatPositionY ?? null,
      chatWidth: user.chatWidth ?? null,
      chatHeight: user.chatHeight ?? null,
      chatOpacity: user.chatOpacity ?? null,
    },
  });
  if (nextExpiry && token) {
    response.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor((nextExpiry.getTime() - Date.now()) / 1000),
      expires: nextExpiry,
    });
  }
  return response;
};
