import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_PLAYER } from "@/lib/gameDefaults";
import { getOrCreatePlayer } from "@/lib/playerRepo";
import { getUserFromSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  const cost = Math.round(12 * player.shelterLevel);
  if (resources.scrap < cost) {
    return NextResponse.json(
      { error: "Not enough scrap." },
      { status: 400 }
    );
  }

  resources.scrap -= cost;
  player.resources = resources;
  player.shelterLevel += 1;
  await player.save();

  return NextResponse.json({ player: player.toJSON() });
};
