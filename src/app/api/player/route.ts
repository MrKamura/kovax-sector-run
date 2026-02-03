import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreatePlayer } from "@/lib/playerRepo";
import { getUserFromSession, refreshSession } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const nextExpiry = await refreshSession(token);
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  // Apply passive regen on periodic player refresh only (not on every action).
  const player = await getOrCreatePlayer(user.id, user.shipChoice, { applyRegen: true });
  const response = NextResponse.json({
    player: player.toJSON(),
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
      musicVolume: Number(user.musicVolume ?? 0.45),
      sfxVolume: Number(user.sfxVolume ?? 0.55),
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
