import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { getOrCreatePlayer } from "@/lib/playerRepo";
import { getUserFromSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const body = await request.json().catch(() => null);
  const amount = Math.max(1, Math.floor(Number(body?.amount ?? 1)) || 1);

  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  if (resources.scrap < amount) {
    return NextResponse.json(
      { error: "Not enough energy." },
      { status: 400 }
    );
  }

  resources.scrap -= amount;
  player.resources = resources;
  await player.save();

  return NextResponse.json({ player: player.toJSON() });
};
