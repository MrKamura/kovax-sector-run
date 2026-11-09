import type { PlayerState, UserState } from "@/store/gameStore";
import { MAX_LEVEL, clamp, pct } from "../constants";
import type { KeeperKey, KeeperFormDisplay } from "../types";

/**
 * Keeper (ship) form display stats (was useKeeperFormDisplay).
 */

function maxStatsForForm(key: KeeperKey) {
  const level = MAX_LEVEL;
  const baseMaxHealth = 100 + Math.max(0, level - 1) * 8;
  const baseDamage = 12 + Math.max(0, level - 1) * 2;
  const healthMod = key === "keeper19" ? 0.85 : 1.2;
  const damageMod = key === "keeper19" ? 0.85 : 1.2;
  const speedMod = key === "keeper19" ? 1.15 : 0.9;
  const hp = Math.round(baseMaxHealth * healthMod);
  const dmg = Math.round(baseDamage * damageMod);
  const spd = Math.round(
    220 * speedMod * (1 + Math.max(0, level - 1) * 0.03)
  );
  return { hp, dmg, spd };
}

function getFormProgress(
  key: KeeperKey,
  player: PlayerState | null,
  user: UserState | null
) {
  const progress = player?.monsterProgress?.[key];
  if (progress) return progress;
  const fallbackLevel = user?.shipChoice === key ? (player?.level ?? 1) : 1;
  const fallbackMaxHealth =
    user?.shipChoice === key ? (player?.maxHealth ?? 100) : 100;
  const fallbackDamage = user?.shipChoice === key ? (player?.damage ?? 12) : 12;
  return {
    level: fallbackLevel,
    exp: 0,
    expToNext: 100,
    health: fallbackMaxHealth,
    maxHealth: fallbackMaxHealth,
    damage: fallbackDamage,
  };
}

function getFormDisplay(
  key: KeeperKey,
  player: PlayerState | null,
  user: UserState | null
): KeeperFormDisplay {
  const progress = getFormProgress(key, player, user);
  const levelRaw = Number(progress.level);
  const level = Number.isFinite(levelRaw) ? clamp(levelRaw, 1, MAX_LEVEL) : 1;
  const hp = Number.isFinite(Number(progress.maxHealth))
    ? Math.max(1, Number(progress.maxHealth))
    : 100;
  const dmg = Number.isFinite(Number(progress.damage))
    ? Math.max(1, Number(progress.damage))
    : 12;
  const baseSpeed =
    220 *
    (key === "keeper19" ? 1.15 : 0.9) *
    (1 + Math.max(0, level - 1) * 0.03);
  return {
    name: key === "keeper19" ? "Keeper 1" : "Keeper 2",
    level,
    hp: Math.round(hp),
    dmg: Math.round(dmg),
    spd: Math.round(baseSpeed),
  };
}

export function getKeeperFormDisplay(
  player: PlayerState | null,
  user: UserState | null
) {
  const formA = getFormDisplay("keeper19", player, user);
  const formB = getFormDisplay("keeper20", player, user);
  const maxA = maxStatsForForm("keeper19");
  const maxB = maxStatsForForm("keeper20");
  const maxHp = Math.max(maxA.hp, maxB.hp) || 1;
  const maxDmg = Math.max(maxA.dmg, maxB.dmg) || 1;
  const maxSpd = Math.max(maxA.spd, maxB.spd) || 1;
  return {
    formA,
    formB,
    maxHp,
    maxDmg,
    maxSpd,
    pct,
  };
}

export type KeeperFormDisplayBundle = ReturnType<typeof getKeeperFormDisplay>;
