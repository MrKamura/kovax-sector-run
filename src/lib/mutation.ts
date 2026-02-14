/**
 * Mutation (character development) system: acquire skills with tokens,
 * upgrade with tokens + time (learning continues offline via absolute endsAt).
 */

import { SKILL_DEFINITIONS } from "./skills";

export const MUTATION_MAX_LEVEL = 5;

export const CONTINUOUS_BEAM_SKILL_ID = "continuous_laser";
export const SHIELD_SKILL_ID = "immunity_5s";
export const ACCELERATION_SKILL_ID = "movement_speed_5s";
export const HEALING_SKILL_ID = "healing_5s";
export const FURY_SKILL_ID = "fury_7s";
export const TELEPORT_SKILL_ID = "teleport_3s";
export const GRAVITY_PIT_SKILL_ID = "gravity_pit";

/** Skill ids that can be purchased in the mutation panel (excludes removed skills like continuous_laser_super). */
export const MUTATION_SKILL_IDS = Object.keys(SKILL_DEFINITIONS).filter(
  (id) => id !== "continuous_laser_super"
);

/** Cost to acquire a given level (1..5). Level 1 = first purchase; 2-5 = upgrades. */
export type LevelCost = { tokens: number; durationMs: number };

/** Continuous Beam: Level 1 = 500 tokens, 0 time; 2 = 1500, 15 min; 3 = 4500, 45 min; 4 = 13500, 135 min; 5 = 40500, 405 min. */
const CONTINUOUS_BEAM_LEVEL_COSTS: LevelCost[] = [
  { tokens: 500, durationMs: 0 },
  { tokens: 1_500, durationMs: 15 * 60 * 1000 },
  { tokens: 4_500, durationMs: 45 * 60 * 1000 },
  { tokens: 13_500, durationMs: 135 * 60 * 1000 },
  { tokens: 40_500, durationMs: 405 * 60 * 1000 },
];

/** Shield (immunity): Level 1 = 350 tokens, 0 time; 2 = 1000, 12 min; 3 = 3000, 40 min; 4 = 9000, 120 min; 5 = 27000, 360 min. */
const SHIELD_LEVEL_COSTS: LevelCost[] = [
  { tokens: 350, durationMs: 0 },
  { tokens: 1_000, durationMs: 12 * 60 * 1000 },
  { tokens: 3_000, durationMs: 40 * 60 * 1000 },
  { tokens: 9_000, durationMs: 120 * 60 * 1000 },
  { tokens: 27_000, durationMs: 360 * 60 * 1000 },
];

/** Acceleration (movement speed): Level 1 = 250 tokens, 0 time; 2 = 750, 10 min; 3 = 2250, 30 min; 4 = 6750, 90 min; 5 = 20250, 270 min. */
const ACCELERATION_LEVEL_COSTS: LevelCost[] = [
  { tokens: 250, durationMs: 0 },
  { tokens: 750, durationMs: 10 * 60 * 1000 },
  { tokens: 2_250, durationMs: 30 * 60 * 1000 },
  { tokens: 6_750, durationMs: 90 * 60 * 1000 },
  { tokens: 20_250, durationMs: 270 * 60 * 1000 },
];

/** Healing: Level 1 = 300 tokens, 0 time; 2 = 900, 12 min; 3 = 2700, 40 min; 4 = 8100, 120 min; 5 = 24300, 360 min. */
const HEALING_LEVEL_COSTS: LevelCost[] = [
  { tokens: 300, durationMs: 0 },
  { tokens: 900, durationMs: 12 * 60 * 1000 },
  { tokens: 2_700, durationMs: 40 * 60 * 1000 },
  { tokens: 8_100, durationMs: 120 * 60 * 1000 },
  { tokens: 24_300, durationMs: 360 * 60 * 1000 },
];

/** Fury: Level 1 = 400 tokens, 0 time; 2 = 1200, 15 min; 3 = 3600, 45 min; 4 = 10800, 135 min; 5 = 32400, 405 min. */
const FURY_LEVEL_COSTS: LevelCost[] = [
  { tokens: 400, durationMs: 0 },
  { tokens: 1_200, durationMs: 15 * 60 * 1000 },
  { tokens: 3_600, durationMs: 45 * 60 * 1000 },
  { tokens: 10_800, durationMs: 135 * 60 * 1000 },
  { tokens: 32_400, durationMs: 405 * 60 * 1000 },
];

/** Teleport: Level 1 = 450 tokens, 0 time; 2 = 1350, 18 min; 3 = 4050, 54 min; 4 = 12150, 162 min; 5 = 36450, 486 min. */
const TELEPORT_LEVEL_COSTS: LevelCost[] = [
  { tokens: 450, durationMs: 0 },
  { tokens: 1_350, durationMs: 18 * 60 * 1000 },
  { tokens: 4_050, durationMs: 54 * 60 * 1000 },
  { tokens: 12_150, durationMs: 162 * 60 * 1000 },
  { tokens: 36_450, durationMs: 486 * 60 * 1000 },
];

/** Gravity pit: Level 1 = 380 tokens, 0 time; 2 = 1140, 14 min; 3 = 3420, 42 min; 4 = 10260, 126 min; 5 = 30780, 378 min. */
const GRAVITY_PIT_LEVEL_COSTS: LevelCost[] = [
  { tokens: 380, durationMs: 0 },
  { tokens: 1_140, durationMs: 14 * 60 * 1000 },
  { tokens: 3_420, durationMs: 42 * 60 * 1000 },
  { tokens: 10_260, durationMs: 126 * 60 * 1000 },
  { tokens: 30_780, durationMs: 378 * 60 * 1000 },
];

/** Default costs for other skills: level 1 = 50 tokens, 0 time; 2-5 = 30,60,90,120,150 tokens + 1..5 days. */
const DEFAULT_LEVEL_COSTS: LevelCost[] = [
  { tokens: 50, durationMs: 0 },
  { tokens: 30, durationMs: 1 * 24 * 60 * 60 * 1000 },
  { tokens: 60, durationMs: 2 * 24 * 60 * 60 * 1000 },
  { tokens: 90, durationMs: 3 * 24 * 60 * 60 * 1000 },
  { tokens: 120, durationMs: 4 * 24 * 60 * 60 * 1000 },
  { tokens: 150, durationMs: 5 * 24 * 60 * 60 * 1000 },
];

export function getSkillLevelCost(
  skillId: string,
  level: number
): LevelCost | null {
  if (level < 1 || level > MUTATION_MAX_LEVEL) return null;
  const costs =
    skillId === CONTINUOUS_BEAM_SKILL_ID
      ? CONTINUOUS_BEAM_LEVEL_COSTS
      : skillId === SHIELD_SKILL_ID
        ? SHIELD_LEVEL_COSTS
        : skillId === ACCELERATION_SKILL_ID
          ? ACCELERATION_LEVEL_COSTS
          : skillId === HEALING_SKILL_ID
            ? HEALING_LEVEL_COSTS
            : skillId === FURY_SKILL_ID
              ? FURY_LEVEL_COSTS
              : skillId === TELEPORT_SKILL_ID
                ? TELEPORT_LEVEL_COSTS
                : skillId === GRAVITY_PIT_SKILL_ID
                  ? GRAVITY_PIT_LEVEL_COSTS
                  : DEFAULT_LEVEL_COSTS;
  const entry = costs[level - 1];
  return entry ?? null;
}

/** Continuous Beam params by level (1..5): duration, damage multiplier, beam count (cones). */
export function getContinuousBeamParams(level: number): {
  durationMs: number;
  damageMultiplier: number;
  beamCount: number;
} {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { durationMs: 3000, damageMultiplier: 2, beamCount: 1 };
    case 2:
      return { durationMs: 6000, damageMultiplier: 3, beamCount: 1 };
    case 3:
      return { durationMs: 3000, damageMultiplier: 2, beamCount: 2 };
    case 4:
      return { durationMs: 6000, damageMultiplier: 2, beamCount: 2 };
    case 5:
      return { durationMs: 6000, damageMultiplier: 2, beamCount: 3 };
    default:
      return { durationMs: 3000, damageMultiplier: 2, beamCount: 1 };
  }
}

/** Shield (immunity) params by level (1..5): invulnerability duration. */
export function getShieldParams(level: number): { durationMs: number } {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { durationMs: 3000 };
    case 2:
      return { durationMs: 5000 };
    case 3:
      return { durationMs: 6000 };
    case 4:
      return { durationMs: 8000 };
    case 5:
      return { durationMs: 10_000 };
    default:
      return { durationMs: 3000 };
  }
}

/** Acceleration (movement speed) params by level (1..5): duration and speed multiplier (e.g. 1.3 = +30% speed). */
export function getAccelerationParams(level: number): {
  durationMs: number;
  speedMultiplier: number;
} {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { durationMs: 3000, speedMultiplier: 1.3 };
    case 2:
      return { durationMs: 5000, speedMultiplier: 1.4 };
    case 3:
      return { durationMs: 6000, speedMultiplier: 1.5 };
    case 4:
      return { durationMs: 7000, speedMultiplier: 1.6 };
    case 5:
      return { durationMs: 8000, speedMultiplier: 1.7 };
    default:
      return { durationMs: 5000, speedMultiplier: 1.5 };
  }
}

/** Healing params by level (1..5): duration of strong health regen. */
export function getHealingParams(level: number): { durationMs: number } {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { durationMs: 3000 };
    case 2:
      return { durationMs: 5000 };
    case 3:
      return { durationMs: 6000 };
    case 4:
      return { durationMs: 8000 };
    case 5:
      return { durationMs: 10_000 };
    default:
      return { durationMs: 5000 };
  }
}

/** Fury params by level (1..5): duration, size multiplier (scale), damage multiplier. */
export function getFuryParams(level: number): {
  durationMs: number;
  sizeMult: number;
  damageMult: number;
} {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { durationMs: 5000, sizeMult: 1.15, damageMult: 1.3 };
    case 2:
      return { durationMs: 7000, sizeMult: 1.2, damageMult: 1.4 };
    case 3:
      return { durationMs: 8000, sizeMult: 1.25, damageMult: 1.5 };
    case 4:
      return { durationMs: 10_000, sizeMult: 1.3, damageMult: 1.6 };
    case 5:
      return { durationMs: 12_000, sizeMult: 1.35, damageMult: 1.7 };
    default:
      return { durationMs: 7000, sizeMult: 1.25, damageMult: 1.5 };
  }
}

/** Teleport params by level (1..5): cast time in ms before teleport. */
export function getTeleportParams(level: number): { castTimeMs: number } {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { castTimeMs: 3000 };
    case 2:
      return { castTimeMs: 2500 };
    case 3:
      return { castTimeMs: 2000 };
    case 4:
      return { castTimeMs: 1500 };
    case 5:
      return { castTimeMs: 1000 };
    default:
      return { castTimeMs: 3000 };
  }
}

/** Gravity pit params by level (1..5): duration and radius. */
export function getGravityPitParams(level: number): {
  durationMs: number;
  radius: number;
} {
  const l = Math.max(1, Math.min(MUTATION_MAX_LEVEL, level));
  switch (l) {
    case 1:
      return { durationMs: 4000, radius: 150 };
    case 2:
      return { durationMs: 5000, radius: 180 };
    case 3:
      return { durationMs: 6000, radius: 200 };
    case 4:
      return { durationMs: 7000, radius: 220 };
    case 5:
      return { durationMs: 8000, radius: 250 };
    default:
      return { durationMs: 5000, radius: 180 };
  }
}

export type MutationState = {
  purchasedSkills: string[];
  skillLevels: Record<string, number>;
  upgradeInProgress: { skillId: string; endsAt: number } | null;
};

export const DEFAULT_MUTATION_STATE: MutationState = {
  purchasedSkills: [],
  skillLevels: {},
  upgradeInProgress: null,
};

/** Energy cost: base + 2 per level for non–Continuous Beam; Continuous Beam uses fixed base. */
export const MUTATION_ENERGY_COST_PER_LEVEL = 2;

export function getEffectiveEnergyCost(
  baseEnergyCost: number,
  level: number
): number {
  const l = Math.max(0, Math.min(MUTATION_MAX_LEVEL, level));
  return baseEnergyCost + l * MUTATION_ENERGY_COST_PER_LEVEL;
}

export function formatDuration(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} д. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${minutes} мин.`;
}
