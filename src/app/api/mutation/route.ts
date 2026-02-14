import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSession } from "@/lib/auth";
import { getOrCreatePlayer, applyMutationCompletion } from "@/lib/playerRepo";
import {
  MUTATION_SKILL_IDS,
  MUTATION_MAX_LEVEL,
  getSkillLevelCost,
} from "@/lib/mutation";

export const runtime = "nodejs";

type MutationState = {
  purchasedSkills: string[];
  skillLevels: Record<string, number>;
  upgradeInProgress: { skillId: string; endsAt: number } | null;
};

function getMutationState(player: { get: (k: string) => unknown }): MutationState {
  const raw = player.get("mutations") as MutationState | undefined;
  if (!raw || !Array.isArray(raw.purchasedSkills)) {
    return { purchasedSkills: [], skillLevels: {}, upgradeInProgress: null };
  }
  return {
    purchasedSkills: raw.purchasedSkills,
    skillLevels: raw.skillLevels && typeof raw.skillLevels === "object" ? raw.skillLevels : {},
    upgradeInProgress: raw.upgradeInProgress ?? null,
  };
}

export const GET = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  await applyMutationCompletion(player);
  const mutations = getMutationState(player);
  const resources = (player as any).resources ?? { scrap: 0, tokens: 0 };
  const tokens = Number(resources.tokens ?? 0) || 0;
  return NextResponse.json({
    mutations,
    tokens,
    player: player.toJSON(),
  });
};

export const POST = async (request: Request) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const action = body?.action === "purchase" ? "purchase" : body?.action === "upgrade" ? "upgrade" : null;
  const skillId = typeof body?.skillId === "string" ? body.skillId.trim().slice(0, 40) : "";
  if (!action || !skillId) {
    return NextResponse.json(
      { error: "action (purchase|upgrade) and skillId are required." },
      { status: 400 }
    );
  }
  if (!MUTATION_SKILL_IDS.includes(skillId)) {
    return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
  }

  const player = await getOrCreatePlayer(user.id, user.shipChoice);
  await applyMutationCompletion(player);
  const mutations = getMutationState(player);
  const resources = (player as any).resources ?? { scrap: 0, tokens: 0 };
  let tokens = Number(resources.tokens ?? 0) || 0;

  if (action === "purchase") {
    const currentLevel = Math.max(0, mutations.skillLevels[skillId] ?? 0);
    if (currentLevel >= 1) {
      return NextResponse.json({ error: "Навык уже куплен." }, { status: 400 });
    }
    const level1Cost = getSkillLevelCost(skillId, 1);
    if (!level1Cost) {
      return NextResponse.json({ error: "Invalid skill or level." }, { status: 400 });
    }
    if (tokens < level1Cost.tokens) {
      return NextResponse.json(
        { error: `Недостаточно токенов. Нужно: ${level1Cost.tokens}.` },
        { status: 400 }
      );
    }
    tokens -= level1Cost.tokens;
    const nextPurchased = [...mutations.purchasedSkills, skillId];
    const nextLevels = { ...mutations.skillLevels, [skillId]: 1 };
    player.set("resources", { ...resources, tokens });
    player.set("mutations", {
      purchasedSkills: nextPurchased,
      skillLevels: nextLevels,
      upgradeInProgress: mutations.upgradeInProgress,
    });
    await player.save();
    return NextResponse.json({
      mutations: getMutationState(player),
      tokens,
      player: player.toJSON(),
    });
  }

  // action === "upgrade"
  const currentLevel = Math.max(0, Math.min(MUTATION_MAX_LEVEL, mutations.skillLevels[skillId] ?? 0));
  if (currentLevel < 1) {
    return NextResponse.json({ error: "Сначала купите навык (уровень 1)." }, { status: 400 });
  }
  if (currentLevel >= MUTATION_MAX_LEVEL) {
    return NextResponse.json({ error: "Навык уже максимального уровня." }, { status: 400 });
  }
  if (mutations.upgradeInProgress) {
    return NextResponse.json(
      { error: "Один навык уже улучшается. Дождитесь окончания." },
      { status: 400 }
    );
  }
  const nextLevel = currentLevel + 1;
  const levelCost = getSkillLevelCost(skillId, nextLevel);
  if (!levelCost) {
    return NextResponse.json({ error: "Invalid level." }, { status: 400 });
  }
  if (tokens < levelCost.tokens) {
    return NextResponse.json(
      { error: `Недостаточно токенов. Нужно: ${levelCost.tokens}.` },
      { status: 400 }
    );
  }
  tokens -= levelCost.tokens;
  const nextLevels = { ...mutations.skillLevels, [skillId]: nextLevel };

  if (levelCost.durationMs <= 0) {
    player.set("resources", { ...resources, tokens });
    player.set("mutations", {
      purchasedSkills: mutations.purchasedSkills,
      skillLevels: nextLevels,
      upgradeInProgress: null,
    });
    await player.save();
    return NextResponse.json({
      mutations: getMutationState(player),
      tokens,
      player: player.toJSON(),
    });
  }

  const endsAt = Date.now() + levelCost.durationMs;
  player.set("resources", { ...resources, tokens });
  player.set("mutations", {
    purchasedSkills: mutations.purchasedSkills,
    skillLevels: mutations.skillLevels,
    upgradeInProgress: { skillId, endsAt },
  });
  await player.save();
  return NextResponse.json({
    mutations: getMutationState(player),
    tokens,
    player: player.toJSON(),
  });
}
