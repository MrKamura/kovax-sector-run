import type { IncomingMessage, ServerResponse } from "http";
import type { RestAuth, RestContext } from "../router";
import { getOrCreatePlayer } from "../playerRepo";
import { refreshSession } from "../auth";
import { readJsonBody, sendJson, sessionCookieHeader } from "../http";
import { DEFAULT_PLAYER, RESOURCE_KEYS, type ResourceKey } from "../../game/shared/gameDefaults";
import { RECIPES, type RecipeId } from "../../game/shared/recipes";

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RestContext,
  auth: RestAuth | null
) => Promise<void>;

export const handlePlayerGet: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const nextExpiry = await refreshSession(ctx.db, auth.token);
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  // Apply passive regen on periodic player refresh only (not on every action).
  const player = await getOrCreatePlayer(ctx.db, user.id, user.shipChoice, { applyRegen: true });
  sendJson(
    res,
    200,
    {
      player: player.toJSON(),
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        shipChoice: user.shipChoice,
        musicVolume: Number(user.musicVolume ?? 0.45),
        sfxVolume: Number(user.sfxVolume ?? 0.55),
      },
    },
    nextExpiry && auth.token
      ? [sessionCookieHeader(auth.token, nextExpiry)]
      : undefined
  );
};

export const handleCollect: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as { resource?: unknown } | null;
  const resource = body?.resource as ResourceKey | undefined;

  if (!resource || !(RESOURCE_KEYS as readonly string[]).includes(resource)) {
    sendJson(res, 400, { error: "Unknown resource." });
    return;
  }

  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }

  const player = await getOrCreatePlayer(ctx.db, user.id, user.shipChoice);
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

  sendJson(res, 200, { player: player.toJSON() });
};

export const handleConsumeEnergy: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  const body = (await readJsonBody(req)) as { amount?: unknown } | null;
  const amount = Math.max(1, Math.floor(Number(body?.amount ?? 1)) || 1);

  const player = await getOrCreatePlayer(ctx.db, user.id, user.shipChoice);
  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  if (resources.scrap < amount) {
    sendJson(res, 400, { error: "Not enough energy." });
    return;
  }

  resources.scrap -= amount;
  player.resources = resources;
  await player.save();

  sendJson(res, 200, { player: player.toJSON() });
};

export const handleCraft: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as { recipeId?: unknown } | null;
  const recipeId = body?.recipeId as RecipeId | undefined;

  if (!recipeId || !RECIPES[recipeId]) {
    sendJson(res, 400, { error: "Unknown recipe." });
    return;
  }

  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }

  const player = await getOrCreatePlayer(ctx.db, user.id, user.shipChoice);
  const recipe = RECIPES[recipeId];
  const blueprints =
    player.blueprints?.length > 0 ? player.blueprints : DEFAULT_PLAYER.blueprints;

  if (!blueprints.includes(recipeId)) {
    sendJson(res, 403, { error: "Blueprint locked." });
    return;
  }

  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  for (const [key, value] of Object.entries(recipe.cost)) {
    const amount = resources[key as keyof typeof resources] ?? 0;
    if (amount < value) {
      sendJson(res, 400, { error: "Not enough resources." });
      return;
    }
  }

  for (const [key, value] of Object.entries(recipe.cost)) {
    resources[key as keyof typeof resources] -= value;
  }

  player.resources = resources;
  player.weapons = [
    ...(player.weapons ?? []),
    {
      id: recipe.id,
      name: recipe.produces.weaponName,
      power: recipe.produces.power,
    },
  ];

  if (recipe.unlocksBlueprint) {
    player.blueprints = Array.from(
      new Set([...blueprints, recipe.unlocksBlueprint])
    );
  }

  await player.save();

  sendJson(res, 200, { player: player.toJSON() });
};

export const handleDamagePlayer: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as { amount?: unknown } | null;
  const amount = Math.max(0, Number(body?.amount ?? 0));
  if (!amount) {
    sendJson(res, 400, { error: "Invalid damage amount." });
    return;
  }

  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }

  const player = await getOrCreatePlayer(ctx.db, user.id, user.shipChoice);
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

  sendJson(res, 200, { player: player.toJSON(), death });
};

export const handleUpgradeShelter: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  const player = await getOrCreatePlayer(ctx.db, user.id, user.shipChoice);
  const resources = {
    ...DEFAULT_PLAYER.resources,
    ...player.resources,
  };

  const cost = Math.round(12 * player.shelterLevel);
  if (resources.scrap < cost) {
    sendJson(res, 400, { error: "Not enough scrap." });
    return;
  }

  resources.scrap -= cost;
  player.resources = resources;
  player.shelterLevel += 1;
  await player.save();

  sendJson(res, 200, { player: player.toJSON() });
};

