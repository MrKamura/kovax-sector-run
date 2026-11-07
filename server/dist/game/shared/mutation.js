"use strict";
/**
 * Mutation (character development) system: acquire skills with tokens,
 * upgrade with tokens + time (learning continues offline via absolute endsAt).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUTATION_ENERGY_COST_PER_LEVEL = exports.DEFAULT_MUTATION_STATE = exports.MUTATION_SKILL_IDS = exports.GRAVITY_PIT_SKILL_ID = exports.TELEPORT_SKILL_ID = exports.FURY_SKILL_ID = exports.HEALING_SKILL_ID = exports.ACCELERATION_SKILL_ID = exports.SHIELD_SKILL_ID = exports.CONTINUOUS_BEAM_SKILL_ID = exports.MUTATION_MAX_LEVEL = void 0;
exports.getSkillLevelCost = getSkillLevelCost;
exports.getContinuousBeamParams = getContinuousBeamParams;
exports.getShieldParams = getShieldParams;
exports.getAccelerationParams = getAccelerationParams;
exports.getHealingParams = getHealingParams;
exports.getFuryParams = getFuryParams;
exports.getTeleportParams = getTeleportParams;
exports.getGravityPitParams = getGravityPitParams;
exports.getEffectiveEnergyCost = getEffectiveEnergyCost;
exports.formatDuration = formatDuration;
const skills_1 = require("./skills");
exports.MUTATION_MAX_LEVEL = 5;
exports.CONTINUOUS_BEAM_SKILL_ID = "continuous_laser";
exports.SHIELD_SKILL_ID = "immunity_5s";
exports.ACCELERATION_SKILL_ID = "movement_speed_5s";
exports.HEALING_SKILL_ID = "healing_5s";
exports.FURY_SKILL_ID = "fury_7s";
exports.TELEPORT_SKILL_ID = "teleport_3s";
exports.GRAVITY_PIT_SKILL_ID = "gravity_pit";
/** Skill ids that can be purchased in the mutation panel (excludes removed skills like continuous_laser_super). */
exports.MUTATION_SKILL_IDS = Object.keys(skills_1.SKILL_DEFINITIONS).filter((id) => id !== "continuous_laser_super");
/** Continuous Beam: Level 1 = 500 tokens, 0 time; 2 = 1500, 15 min; 3 = 4500, 45 min; 4 = 13500, 135 min; 5 = 40500, 405 min. */
const CONTINUOUS_BEAM_LEVEL_COSTS = [
    { tokens: 500, durationMs: 0 },
    { tokens: 1500, durationMs: 15 * 60 * 1000 },
    { tokens: 4500, durationMs: 45 * 60 * 1000 },
    { tokens: 13500, durationMs: 135 * 60 * 1000 },
    { tokens: 40500, durationMs: 405 * 60 * 1000 },
];
/** Shield (immunity): Level 1 = 350 tokens, 0 time; 2 = 1000, 12 min; 3 = 3000, 40 min; 4 = 9000, 120 min; 5 = 27000, 360 min. */
const SHIELD_LEVEL_COSTS = [
    { tokens: 350, durationMs: 0 },
    { tokens: 1000, durationMs: 12 * 60 * 1000 },
    { tokens: 3000, durationMs: 40 * 60 * 1000 },
    { tokens: 9000, durationMs: 120 * 60 * 1000 },
    { tokens: 27000, durationMs: 360 * 60 * 1000 },
];
/** Acceleration (movement speed): Level 1 = 250 tokens, 0 time; 2 = 750, 10 min; 3 = 2250, 30 min; 4 = 6750, 90 min; 5 = 20250, 270 min. */
const ACCELERATION_LEVEL_COSTS = [
    { tokens: 250, durationMs: 0 },
    { tokens: 750, durationMs: 10 * 60 * 1000 },
    { tokens: 2250, durationMs: 30 * 60 * 1000 },
    { tokens: 6750, durationMs: 90 * 60 * 1000 },
    { tokens: 20250, durationMs: 270 * 60 * 1000 },
];
/** Healing: Level 1 = 300 tokens, 0 time; 2 = 900, 12 min; 3 = 2700, 40 min; 4 = 8100, 120 min; 5 = 24300, 360 min. */
const HEALING_LEVEL_COSTS = [
    { tokens: 300, durationMs: 0 },
    { tokens: 900, durationMs: 12 * 60 * 1000 },
    { tokens: 2700, durationMs: 40 * 60 * 1000 },
    { tokens: 8100, durationMs: 120 * 60 * 1000 },
    { tokens: 24300, durationMs: 360 * 60 * 1000 },
];
/** Fury: Level 1 = 400 tokens, 0 time; 2 = 1200, 15 min; 3 = 3600, 45 min; 4 = 10800, 135 min; 5 = 32400, 405 min. */
const FURY_LEVEL_COSTS = [
    { tokens: 400, durationMs: 0 },
    { tokens: 1200, durationMs: 15 * 60 * 1000 },
    { tokens: 3600, durationMs: 45 * 60 * 1000 },
    { tokens: 10800, durationMs: 135 * 60 * 1000 },
    { tokens: 32400, durationMs: 405 * 60 * 1000 },
];
/** Teleport: Level 1 = 450 tokens, 0 time; 2 = 1350, 18 min; 3 = 4050, 54 min; 4 = 12150, 162 min; 5 = 36450, 486 min. */
const TELEPORT_LEVEL_COSTS = [
    { tokens: 450, durationMs: 0 },
    { tokens: 1350, durationMs: 18 * 60 * 1000 },
    { tokens: 4050, durationMs: 54 * 60 * 1000 },
    { tokens: 12150, durationMs: 162 * 60 * 1000 },
    { tokens: 36450, durationMs: 486 * 60 * 1000 },
];
/** Gravity pit: Level 1 = 380 tokens, 0 time; 2 = 1140, 14 min; 3 = 3420, 42 min; 4 = 10260, 126 min; 5 = 30780, 378 min. */
const GRAVITY_PIT_LEVEL_COSTS = [
    { tokens: 380, durationMs: 0 },
    { tokens: 1140, durationMs: 14 * 60 * 1000 },
    { tokens: 3420, durationMs: 42 * 60 * 1000 },
    { tokens: 10260, durationMs: 126 * 60 * 1000 },
    { tokens: 30780, durationMs: 378 * 60 * 1000 },
];
/** Default costs for other skills: level 1 = 50 tokens, 0 time; 2-5 = 30,60,90,120,150 tokens + 1..5 days. */
const DEFAULT_LEVEL_COSTS = [
    { tokens: 50, durationMs: 0 },
    { tokens: 30, durationMs: 1 * 24 * 60 * 60 * 1000 },
    { tokens: 60, durationMs: 2 * 24 * 60 * 60 * 1000 },
    { tokens: 90, durationMs: 3 * 24 * 60 * 60 * 1000 },
    { tokens: 120, durationMs: 4 * 24 * 60 * 60 * 1000 },
    { tokens: 150, durationMs: 5 * 24 * 60 * 60 * 1000 },
];
function getSkillLevelCost(skillId, level) {
    if (level < 1 || level > exports.MUTATION_MAX_LEVEL)
        return null;
    const costs = skillId === exports.CONTINUOUS_BEAM_SKILL_ID
        ? CONTINUOUS_BEAM_LEVEL_COSTS
        : skillId === exports.SHIELD_SKILL_ID
            ? SHIELD_LEVEL_COSTS
            : skillId === exports.ACCELERATION_SKILL_ID
                ? ACCELERATION_LEVEL_COSTS
                : skillId === exports.HEALING_SKILL_ID
                    ? HEALING_LEVEL_COSTS
                    : skillId === exports.FURY_SKILL_ID
                        ? FURY_LEVEL_COSTS
                        : skillId === exports.TELEPORT_SKILL_ID
                            ? TELEPORT_LEVEL_COSTS
                            : skillId === exports.GRAVITY_PIT_SKILL_ID
                                ? GRAVITY_PIT_LEVEL_COSTS
                                : DEFAULT_LEVEL_COSTS;
    const entry = costs[level - 1];
    return entry ?? null;
}
/** Continuous Beam params by level (1..5): duration, damage multiplier, beam count (cones). */
function getContinuousBeamParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
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
function getShieldParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
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
            return { durationMs: 10000 };
        default:
            return { durationMs: 3000 };
    }
}
/** Acceleration (movement speed) params by level (1..5): duration and speed multiplier (e.g. 1.3 = +30% speed). */
function getAccelerationParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
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
function getHealingParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
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
            return { durationMs: 10000 };
        default:
            return { durationMs: 5000 };
    }
}
/** Fury params by level (1..5): duration, size multiplier (scale), damage multiplier. */
function getFuryParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
    switch (l) {
        case 1:
            return { durationMs: 5000, sizeMult: 1.15, damageMult: 1.3 };
        case 2:
            return { durationMs: 7000, sizeMult: 1.2, damageMult: 1.4 };
        case 3:
            return { durationMs: 8000, sizeMult: 1.25, damageMult: 1.5 };
        case 4:
            return { durationMs: 10000, sizeMult: 1.3, damageMult: 1.6 };
        case 5:
            return { durationMs: 12000, sizeMult: 1.35, damageMult: 1.7 };
        default:
            return { durationMs: 7000, sizeMult: 1.25, damageMult: 1.5 };
    }
}
/** Teleport params by level (1..5): cast time in ms before teleport. */
function getTeleportParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
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
function getGravityPitParams(level) {
    const l = Math.max(1, Math.min(exports.MUTATION_MAX_LEVEL, level));
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
exports.DEFAULT_MUTATION_STATE = {
    purchasedSkills: [],
    skillLevels: {},
    upgradeInProgress: null,
};
/** Energy cost: base + 2 per level for non–Continuous Beam; Continuous Beam uses fixed base. */
exports.MUTATION_ENERGY_COST_PER_LEVEL = 2;
function getEffectiveEnergyCost(baseEnergyCost, level) {
    const l = Math.max(0, Math.min(exports.MUTATION_MAX_LEVEL, level));
    return baseEnergyCost + l * exports.MUTATION_ENERGY_COST_PER_LEVEL;
}
function formatDuration(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (days > 0)
        return `${days} д. ${hours} ч.`;
    if (hours > 0)
        return `${hours} ч. ${minutes} мин.`;
    return `${minutes} мин.`;
}
