import { DEFAULT_PLAYER } from "./gameDefaults";
import { initModels, Player } from "./modelInit";

const HEALTH_REGEN_INTERVAL_MS = 3000;
const BASE_MAX_HEALTH = 100;
const BASE_DAMAGE = 12;
const BASE_ENERGY_CAP = 10;
const ENERGY_PER_LEVEL = 3;
const MAX_PLAYER_LEVEL = 100;
const clampLevel = (level: number) => {
  const n = Number(level);
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_PLAYER_LEVEL, n));
};

const expToNextLevel = (level: number) =>
  100 + Math.max(0, clampLevel(level) - 1) * 60;
const maxHealthForLevel = (level: number) =>
  BASE_MAX_HEALTH + Math.max(0, clampLevel(level) - 1) * 8;
const damageForLevel = (level: number) =>
  BASE_DAMAGE + Math.max(0, clampLevel(level) - 1) * 2;
const energyCapForLevel = (level: number) =>
  BASE_ENERGY_CAP + Math.floor(Math.max(0, clampLevel(level) - 1) / 3);

const PLAYER_MONSTER_MODS: Record<string, { maxHealth: number; damage: number }> =
  {
    keeper19: { maxHealth: 0.85, damage: 0.85 },
    keeper20: { maxHealth: 1.2, damage: 1.2 },
  };

const statsForLevel = (level: number, shipChoice?: string | null) => {
  const base = {
    maxHealth: maxHealthForLevel(level),
    damage: damageForLevel(level),
  };
  if (!shipChoice || !PLAYER_MONSTER_MODS[shipChoice]) {
    return base;
  }
  const mod = PLAYER_MONSTER_MODS[shipChoice];
  return {
    maxHealth: Math.round(base.maxHealth * mod.maxHealth),
    damage: Math.round(base.damage * mod.damage),
  };
};

/** Ensure all default skills are in player.skills; merge and persist so new skills appear for existing players. */
const ensureDefaultSkillsIncluded = async (player: Player) => {
  const defaultSkills = DEFAULT_PLAYER.skills;
  const raw = player.get("skills");
  const currentSkills: string[] = Array.isArray(raw) ? (raw as string[]) : [];
  const merged: string[] = [...currentSkills];
  for (const id of defaultSkills) {
    if (!merged.includes(id) && merged.length < 9) merged.push(id);
  }
  const final = merged.slice(0, 9);
  if (final.length !== currentSkills.length || final.some((s, i) => s !== currentSkills[i])) {
    player.set("skills", final);
    await player.save();
  }
};

const ensureHealthDefaults = async (player: Player, shipChoice?: string | null) => {
  let changed = false;
  if (player.level == null) {
    player.level = DEFAULT_PLAYER.level;
    changed = true;
  }
  if (player.exp == null) {
    player.exp = DEFAULT_PLAYER.exp;
    changed = true;
  }
  const level = clampLevel(player.level ?? DEFAULT_PLAYER.level);
  if (player.level !== level) {
    player.level = level;
    changed = true;
  }
  const desiredExpToNext = expToNextLevel(level);
  const stats = statsForLevel(level, shipChoice);
  const desiredDamage = stats.damage;
  const desiredMaxHealth = stats.maxHealth;
  if (player.expToNext == null || player.expToNext !== desiredExpToNext) {
    player.expToNext = desiredExpToNext;
    changed = true;
  }
  if (player.damage == null || player.damage !== desiredDamage) {
    player.damage = desiredDamage;
    changed = true;
  }
  const defaultSkills = DEFAULT_PLAYER.skills;
  const currentSkills = Array.isArray(player.skills) ? player.skills : [];
  if (currentSkills.length === 0) {
    player.skills = [...defaultSkills];
    changed = true;
  } else {
    const merged = [...currentSkills];
    for (const id of defaultSkills) {
      if (!merged.includes(id) && merged.length < 9) merged.push(id);
    }
    if (merged.length !== currentSkills.length || merged.some((s, i) => s !== currentSkills[i])) {
      player.skills = merged.slice(0, 9);
      changed = true;
    }
  }
  if (player.maxHealth == null || player.maxHealth !== desiredMaxHealth) {
    player.maxHealth = desiredMaxHealth;
    changed = true;
  }
  if (player.health == null) {
    player.health = player.maxHealth ?? DEFAULT_PLAYER.maxHealth;
    changed = true;
  }
  if (player.lastHealthAt === undefined) {
    player.lastHealthAt = DEFAULT_PLAYER.lastHealthAt;
    changed = true;
  }
  if (changed) {
    await player.save();
  }
};

const applyHealthRegen = async (player: Player, shipChoice?: string | null) => {
  await ensureHealthDefaults(player, shipChoice);
  const maxHealth = player.maxHealth ?? DEFAULT_PLAYER.maxHealth;
  const health = player.health ?? maxHealth;
  // IMPORTANT: never "revive" a dead player via passive regen.
  // Respawn must be an explicit action (OK button).
  if (health <= 0) {
    return;
  }
  if (health >= maxHealth) {
    return;
  }
  const now = Date.now();
  const last = player.lastHealthAt
    ? new Date(player.lastHealthAt).getTime()
    : now;
  const elapsed = now - last;
  if (elapsed < HEALTH_REGEN_INTERVAL_MS) {
    return;
  }
  const regen = Math.floor(elapsed / HEALTH_REGEN_INTERVAL_MS);
  const nextHealth = Math.min(maxHealth, health + regen);
  player.health = nextHealth;
  player.lastHealthAt = new Date(now);
  if (shipChoice) {
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
    if (progress[shipChoice]) {
      progress[shipChoice] = { ...progress[shipChoice], health: nextHealth };
      player.monsterProgress = progress;
    }
  }
  await player.save();
};

const ensureMonsterProgress = async (
  player: Player,
  shipChoice?: string | null
) => {
  if (!shipChoice) {
    return;
  }
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
  const existingRaw = progress[shipChoice] as any;
  const rawLevel = Number(existingRaw?.level);
  const level = Number.isFinite(rawLevel) && rawLevel > 0
    ? clampLevel(rawLevel)
    : (player.level ?? DEFAULT_PLAYER.level);
  const rawExp = Number(existingRaw?.exp);
  const exp = Number.isFinite(rawExp) && rawExp >= 0 ? rawExp : (player.exp ?? DEFAULT_PLAYER.exp);
  const rawExpToNext = Number(existingRaw?.expToNext);
  const expToNext =
    Number.isFinite(rawExpToNext) && rawExpToNext > 0
      ? rawExpToNext
      : expToNextLevel(level);
  const stats = statsForLevel(level, shipChoice);
  const rawMaxHealth = Number(existingRaw?.maxHealth);
  const maxHealth =
    Number.isFinite(rawMaxHealth) && rawMaxHealth > 0
      ? rawMaxHealth
      : stats.maxHealth;
  const rawDamage = Number(existingRaw?.damage);
  const damage =
    Number.isFinite(rawDamage) && rawDamage > 0 ? rawDamage : stats.damage;
  // IMPORTANT: treat the DB `player.health` as canonical to avoid other API calls
  // (collect/craft/etc.) snapping health back to a stale monsterProgress value.
  const dbHealthRaw = Number((player as any).health);
  const rawHealth = Number(existingRaw?.health);
  const fallbackHealth = player.health ?? maxHealth;
  const chosenHealthRaw = Number.isFinite(dbHealthRaw)
    ? dbHealthRaw
    : Number.isFinite(rawHealth)
    ? rawHealth
    : Number(fallbackHealth);
  const health = Math.max(0, Math.min(maxHealth, chosenHealthRaw));
  const nextProgress = {
    ...progress,
    [shipChoice]: { level, exp, expToNext, health, maxHealth, damage },
  };
  let changed = false;
  if (player.level !== level) {
    player.level = level;
    changed = true;
  }
  if (player.exp !== exp) {
    player.exp = exp;
    changed = true;
  }
  if (player.expToNext !== expToNext) {
    player.expToNext = expToNext;
    changed = true;
  }
  if (player.maxHealth !== maxHealth) {
    player.maxHealth = maxHealth;
    changed = true;
  }
  if (player.damage !== damage) {
    player.damage = damage;
    changed = true;
  }
  if (player.health !== health) {
    player.health = health;
    changed = true;
  }
  if (player.monsterProgress !== nextProgress) {
    player.monsterProgress = nextProgress;
    changed = true;
  }
  if (changed) {
    await player.save();
  }
};

export const getOrCreatePlayer = async (
  userId: number,
  shipChoice?: string | null,
  options?: { applyRegen?: boolean }
) => {
  await initModels();
  const applyRegen = options?.applyRegen === true;

  const existing = await Player.findOne({ where: { userId } });
  if (existing) {
    await ensureDefaultSkillsIncluded(existing);
    await ensureMonsterProgress(existing, shipChoice);
    if (applyRegen) {
      await applyHealthRegen(existing, shipChoice);
    }
    return existing;
  }

  const level = DEFAULT_PLAYER.level ?? 1;
  const resources = {
    ...DEFAULT_PLAYER.resources,
    scrap: energyCapForLevel(level),
    tokens: 0,
  };
  const created = await Player.create({
    ...DEFAULT_PLAYER,
    resources,
    userId,
    lastCollectedAt: null,
    monsterProgress: {},
  });
  await ensureMonsterProgress(created, shipChoice);
  if (applyRegen) {
    await applyHealthRegen(created, shipChoice);
  }
  return created;
};
