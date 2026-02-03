import {
  MAX_PLAYER_LEVEL,
  PLAYER_MONSTER_MODS,
  BASE_PLAYER_MAX_HEALTH,
  BASE_PLAYER_DAMAGE,
  ENEMY_HEALTH,
  BASE_ENEMY_DAMAGE,
  BASE_ENERGY_CAP,
  ENERGY_CAP_PER_LEVEL,
  SECTOR_CONFIGS,
  SECTOR_NAMES,
} from "../config/constants";

export const worldSeed = Date.now() % 100000;
const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    const r = Math.imul(t ^ (t >>> 15), 1 | t);
    const r2 = (r ^ (r + Math.imul(r ^ (r >>> 7), 61 | r)) >>> 0) / 4294967296;
    return r2;
  };
};
export const rand = mulberry32(worldSeed);
export const randBetween = (min: number, max: number) => min + (max - min) * rand();
export const randInt = (min: number, max: number) => Math.floor(randBetween(min, max + 1));

export function clampLevel(level: number): number {
  const n = Number(level);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_PLAYER_LEVEL, n));
}

export const expToNextLevel = (level: number) =>
  100 + Math.max(0, clampLevel(level) - 1) * 60;

export function playerStatsForLevel(
  level: number,
  shipChoice: string | null | undefined
): { maxHealth: number; damage: number } {
  const safeLevel = clampLevel(level);
  const stats = {
    maxHealth: BASE_PLAYER_MAX_HEALTH + Math.max(0, safeLevel - 1) * 8,
    damage: BASE_PLAYER_DAMAGE + Math.max(0, safeLevel - 1) * 2,
  };
  const mod = shipChoice ? PLAYER_MONSTER_MODS[shipChoice] : null;
  if (!mod) return stats;
  return {
    maxHealth: Math.round(stats.maxHealth * mod.maxHealth),
    damage: Math.round(stats.damage * mod.damage),
  };
}

export const normalizeMonsterChoice = (choice: string | null | undefined) =>
  choice === "keeper20" ? "keeper20" : "keeper19";

export function getMonsterProgressEntry(
  progress: Record<string, unknown> | null | undefined,
  key: string
): { level?: number; exp?: number; expToNext?: number; health?: number; maxHealth?: number; damage?: number } | null {
  if (!progress || typeof progress !== "object") return null;
  const entry = progress[key];
  if (!entry || typeof entry !== "object") return null;
  return entry as { level?: number; exp?: number; expToNext?: number; health?: number; maxHealth?: number; damage?: number };
}

export const enemyStatsForLevel = (level: number) => ({
  maxHealth: ENEMY_HEALTH + Math.max(0, level - 1) * 40,
  damage: BASE_ENEMY_DAMAGE + Math.max(0, level - 1) * 1,
});

export const energyCapForLevel = (level: number) =>
  BASE_ENERGY_CAP + Math.max(0, level - 1) * ENERGY_CAP_PER_LEVEL;

export const tokensForMobLevel = (level: number) => {
  const L = Math.max(1, Number(level) || 1);
  return 10 + Math.max(0, L - 1) * 5;
};

export function generateSectorName(level: number): string {
  const config = SECTOR_CONFIGS[level];
  if (!config) return `Sector L${level}`;
  const base = SECTOR_NAMES[randInt(0, SECTOR_NAMES.length - 1)];
  return `${config.namePrefix} L${level} • ${base}-${randInt(1, 99)}`;
}
