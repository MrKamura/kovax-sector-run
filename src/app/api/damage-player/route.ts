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
  const body = await request.json().catch(() => null);
  const amount = Math.max(0, Number(body?.amount ?? 0));
  if (!amount) {
    return NextResponse.json(
      { error: "Invalid damage amount." },
      { status: 400 }
    );
  }

  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }

  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  const maxHealth = player.maxHealth ?? DEFAULT_PLAYER.maxHealth;
  const currentHealth = player.health ?? maxHealth;
  const nextHealth = Math.max(0, currentHealth - amount);
  const wasAlive = currentHealth > 0;
  const diedNow = wasAlive && nextHealth === 0;
  player.health = nextHealth;
  player.lastHealthAt = new Date();

  let death;
  if (diedNow) {
    const resources = { ...DEFAULT_PLAYER.resources, ...player.resources };
    const tokens = Number(resources.tokens ?? 0) || 0;
    const exp = Number(player.exp ?? 0) || 0;
    const tokenPercent = Math.max(1, Math.floor(Math.random() * 30) + 1) / 100;
    const expPercent = Math.max(1, Math.floor(Math.random() * 30) + 1) / 100;
    let lostTokens = Math.floor(tokens * tokenPercent);
    let lostExp = Math.floor(exp * expPercent);
    if (tokens > 0 && lostTokens === 0) {
      lostTokens = 1;
    }
    if (exp > 0 && lostExp === 0) {
      lostExp = 1;
    }
    resources.tokens = Math.max(0, tokens - lostTokens);
    player.resources = resources;
    player.exp = Math.max(0, exp - lostExp);
    death = { lostTokens, lostExp };
  }

  // Persist per-form health/exp progression (otherwise it can snap back to the
  // last saved monsterProgress entry and look like HP "doesn't subtract").
  const choice = user.shipChoice;
  if (choice) {
    const progress = (player.monsterProgress ?? {}) as Record<
      string,
      {
        level: number;
        exp: number;
        expToNext: number;
        health: number;
        maxHealth: number;
        damage: number;
      }
    >;
    const existing = progress[choice] ?? {
      level: player.level ?? 1,
      exp: player.exp ?? 0,
      expToNext: player.expToNext ?? 100,
      health: nextHealth,
      maxHealth: player.maxHealth ?? maxHealth,
      damage: player.damage ?? 12,
    };
    progress[choice] = {
      ...existing,
      level: player.level ?? existing.level,
      exp: player.exp ?? existing.exp,
      expToNext: player.expToNext ?? existing.expToNext,
      health: nextHealth,
      maxHealth: player.maxHealth ?? existing.maxHealth,
      damage: player.damage ?? existing.damage,
    };
    player.monsterProgress = progress;
  }

  await player.save();

  return NextResponse.json({ player: player.toJSON(), death });
};
