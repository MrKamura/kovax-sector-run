"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokensForMobLevel = exports.energyCapForLevel = exports.enemyStatsForLevel = exports.normalizeMonsterChoice = exports.expToNextLevel = exports.randInt = exports.randBetween = exports.rand = exports.worldSeed = void 0;
exports.clampLevel = clampLevel;
exports.playerStatsForLevel = playerStatsForLevel;
exports.getMonsterProgressEntry = getMonsterProgressEntry;
exports.generateSectorName = generateSectorName;
const constants_1 = require("../config/constants");
exports.worldSeed = Date.now() % 100000;
const mulberry32 = (seed) => {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        const r = Math.imul(t ^ (t >>> 15), 1 | t);
        const r2 = (r ^ (r + Math.imul(r ^ (r >>> 7), 61 | r)) >>> 0) / 4294967296;
        return r2;
    };
};
exports.rand = mulberry32(exports.worldSeed);
const randBetween = (min, max) => min + (max - min) * (0, exports.rand)();
exports.randBetween = randBetween;
const randInt = (min, max) => Math.floor((0, exports.randBetween)(min, max + 1));
exports.randInt = randInt;
function clampLevel(level) {
    const n = Number(level);
    if (!Number.isFinite(n))
        return 1;
    return Math.max(1, Math.min(constants_1.MAX_PLAYER_LEVEL, n));
}
const expToNextLevel = (level) => 100 + Math.max(0, clampLevel(level) - 1) * 60;
exports.expToNextLevel = expToNextLevel;
function playerStatsForLevel(level, shipChoice) {
    const safeLevel = clampLevel(level);
    const stats = {
        maxHealth: constants_1.BASE_PLAYER_MAX_HEALTH + Math.max(0, safeLevel - 1) * 8,
        damage: constants_1.BASE_PLAYER_DAMAGE + Math.max(0, safeLevel - 1) * 2,
    };
    const mod = shipChoice ? constants_1.PLAYER_MONSTER_MODS[shipChoice] : null;
    if (!mod)
        return stats;
    return {
        maxHealth: Math.round(stats.maxHealth * mod.maxHealth),
        damage: Math.round(stats.damage * mod.damage),
    };
}
const normalizeMonsterChoice = (choice) => choice === "keeper20" ? "keeper20" : "keeper19";
exports.normalizeMonsterChoice = normalizeMonsterChoice;
function getMonsterProgressEntry(progress, key) {
    if (!progress || typeof progress !== "object")
        return null;
    const entry = progress[key];
    if (!entry || typeof entry !== "object")
        return null;
    return entry;
}
const enemyStatsForLevel = (level) => ({
    maxHealth: constants_1.ENEMY_HEALTH + Math.max(0, level - 1) * 40,
    damage: constants_1.BASE_ENEMY_DAMAGE + Math.max(0, level - 1) * 1,
});
exports.enemyStatsForLevel = enemyStatsForLevel;
const energyCapForLevel = (level) => constants_1.BASE_ENERGY_CAP + Math.floor(Math.max(0, level - 1) / 3);
exports.energyCapForLevel = energyCapForLevel;
const tokensForMobLevel = (level) => {
    const L = Math.max(1, Number(level) || 1);
    return 10 + Math.max(0, L - 1) * 5;
};
exports.tokensForMobLevel = tokensForMobLevel;
function generateSectorName(level) {
    const config = constants_1.SECTOR_CONFIGS[level];
    if (!config)
        return `Sector L${level}`;
    const base = constants_1.SECTOR_NAMES[(0, exports.randInt)(0, constants_1.SECTOR_NAMES.length - 1)];
    return `${config.namePrefix} L${level} • ${base}-${(0, exports.randInt)(1, 99)}`;
}
