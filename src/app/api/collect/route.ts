import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_PLAYER, RESOURCE_KEYS } from "@/lib/gameDefaults";
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
  const body = await request.json().catch(() => null);
  const resource = body?.resource as (typeof RESOURCE_KEYS)[number] | undefined;

  if (!resource || !RESOURCE_KEYS.includes(resource)) {
    return NextResponse.json(
      { error: "Unknown resource." },
      { status: 400 }
    );
  }

  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }

  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  const gain = resource === "scrap" ? 3 : 1;
  if (resource === "scrap") {
    const level = player.level ?? 1;
    const capacity = 10 + Math.max(0, level - 1) * 3;
    resources.scrap = Math.min(resources.scrap + gain, capacity);
  } else {
    resources[resource] += gain;
  }

  player.resources = resources;
  player.lastCollectedAt = new Date();
  await player.save();

  return NextResponse.json({ player: player.toJSON() });
};
