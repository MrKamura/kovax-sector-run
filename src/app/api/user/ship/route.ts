import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/auth";
import { getOrCreatePlayer } from "@/lib/playerRepo";

export const runtime = "nodejs";

const ALLOWED_SHIPS = ["keeper19", "keeper20"] as const;

const PLAYER_MONSTER_MODS: Record<string, { maxHealth: number; damage: number }> =
  {
    keeper19: { maxHealth: 0.85, damage: 0.85 },
    keeper20: { maxHealth: 1.2, damage: 1.2 },
  };
const expToNextLevel = (level: number) => 100 + Math.max(0, level - 1) * 60;
const statsForLevel = (level: number, choice: string) => {
  const base = {
    maxHealth: 100 + Math.max(0, level - 1) * 8,
    damage: 12 + Math.max(0, level - 1) * 2,
  };
  const mod = PLAYER_MONSTER_MODS[choice];
  if (!mod) {
    return base;
  }
  return {
    maxHealth: Math.round(base.maxHealth * mod.maxHealth),
    damage: Math.round(base.damage * mod.damage),
  };
};

export const POST = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const ship = body?.ship as (typeof ALLOWED_SHIPS)[number] | undefined;
  if (!ship || !ALLOWED_SHIPS.includes(ship)) {
    return NextResponse.json({ error: "Unknown monster choice." }, { status: 400 });
  }
  if (!user.id) {
    return NextResponse.json({ error: "User ID not found." }, { status: 500 });
  }
  const previousChoice = user.shipChoice;
  const player = await getOrCreatePlayer(user.id, previousChoice);
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
  if (previousChoice) {
    const prevLevel = player.level ?? 1;
    const prevStats = statsForLevel(prevLevel, previousChoice);
    progress[previousChoice] = {
      level: prevLevel,
      exp: player.exp ?? 0,
      expToNext: player.expToNext ?? expToNextLevel(prevLevel),
      health: player.health ?? prevStats.maxHealth,
      maxHealth: player.maxHealth ?? prevStats.maxHealth,
      damage: player.damage ?? prevStats.damage,
    };
  }
  if (!progress[ship]) {
    const baseLevel = 1;
    const stats = statsForLevel(baseLevel, ship);
    progress[ship] = {
      level: baseLevel,
      exp: 0,
      expToNext: expToNextLevel(baseLevel),
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      damage: stats.damage,
    };
  }
  const nextProgress = progress[ship];
  player.level = nextProgress.level;
  player.exp = nextProgress.exp;
  player.expToNext = nextProgress.expToNext;
  player.health = nextProgress.health;
  player.maxHealth = nextProgress.maxHealth;
  player.damage = nextProgress.damage;
  player.monsterProgress = progress;
  await player.save();

  user.shipChoice = ship;
  await user.save();
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
    },
  });
};
