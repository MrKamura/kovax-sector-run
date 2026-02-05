"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL = exports.BLACK_HOLE_SAME_LEVEL_WEIGHT = exports.BLACK_HOLE_GRADE_WEIGHTS = exports.TOTAL_PREDEFINED_SECTORS = exports.SECTOR_LEVELS = exports.SECTOR_NAMES = exports.TICK_INTERVAL_MS = exports.VENGEANCE_HUNTED_PUSH_INTERVAL_MS = exports.CHAT_HISTORY_LIMIT = exports.MAX_PLAYER_LEVEL = exports.ENERGY_CAP_PER_LEVEL = exports.BASE_ENERGY_CAP = exports.BASE_ENEMY_DAMAGE = exports.BASE_PLAYER_DAMAGE = exports.PVP_DEATH_PENALTY_EXTRA_MULT = exports.PVP_DEATH_PENALTY_PERCENT_BY_GRADE = exports.PVE_DEATH_PENALTY_PERCENT_BY_GRADE = exports.DEATH_PENALTY_BASE_PERCENT_MAX = exports.DEATH_PENALTY_BASE_PERCENT_MIN = exports.BASE_PLAYER_MAX_HEALTH = exports.VENGEANCE_DAMAGE_MULT = exports.VENGEANCE_DURATION_MS = exports.FURY_DAMAGE_MULT = exports.EXIT_GRACE_MS = exports.EXIT_GRACE_SEC = exports.SPAWN_IMMUNITY_AFTER_ACTION_MS = exports.SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = exports.GRAVITY_PIT_SLOW = exports.GRAVITY_PIT_DURATION_MS = exports.GRAVITY_PIT_RADIUS = exports.SAFE_ZONE_EXIT_IMMUNITY_MS = exports.SAFE_ZONE_RADIUS = exports.SAFE_ZONE_COOLDOWN_MS = exports.SAFE_ZONE_DURATION_MS = exports.MAX_BLACK_HOLES_PER_SECTOR = exports.BLACK_HOLE_APPEAR_DELAY_MS = exports.BLACK_HOLE_DURATION_MS = exports.SECTOR_CAPACITY = exports.ASTEROID_COUNT = exports.PICKUP_RESPAWN_MS = exports.MAX_PICKUPS = exports.ENEMY_ROAM_RADIUS = exports.ENEMY_HEALTH = exports.ENEMY_VISION_RANGE = exports.ENEMY_SPEED = exports.ENEMY_RESPAWN_MS = exports.ENEMY_COUNT = exports.LEVEL2_SIZE_MULTIPLIER = exports.WORLD_BASE_HEIGHT = exports.WORLD_BASE_WIDTH = void 0;
exports.PLAYER_MONSTER_MODS = exports.ENEMY_TYPE_LEVEL = exports.SECTOR_CONFIGS = void 0;
exports.WORLD_BASE_WIDTH = 2200;
exports.WORLD_BASE_HEIGHT = 1600;
exports.LEVEL2_SIZE_MULTIPLIER = 2;
exports.ENEMY_COUNT = 8;
exports.ENEMY_RESPAWN_MS = 12000;
exports.ENEMY_SPEED = 90;
exports.ENEMY_VISION_RANGE = 520;
exports.ENEMY_HEALTH = 90;
exports.ENEMY_ROAM_RADIUS = 260;
exports.MAX_PICKUPS = 12;
exports.PICKUP_RESPAWN_MS = 7000;
exports.ASTEROID_COUNT = 52;
exports.SECTOR_CAPACITY = 20;
exports.BLACK_HOLE_DURATION_MS = 60000;
exports.BLACK_HOLE_APPEAR_DELAY_MS = 6000;
exports.MAX_BLACK_HOLES_PER_SECTOR = 6;
exports.SAFE_ZONE_DURATION_MS = 60000;
exports.SAFE_ZONE_COOLDOWN_MS = 5 * 60 * 1000;
exports.SAFE_ZONE_RADIUS = 120;
exports.SAFE_ZONE_EXIT_IMMUNITY_MS = 5000;
exports.GRAVITY_PIT_RADIUS = 180;
exports.GRAVITY_PIT_DURATION_MS = 5000;
exports.GRAVITY_PIT_SLOW = 0.35;
exports.SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = 1e15;
exports.SPAWN_IMMUNITY_AFTER_ACTION_MS = 5000;
exports.EXIT_GRACE_SEC = 5;
exports.EXIT_GRACE_MS = exports.EXIT_GRACE_SEC * 1000;
exports.FURY_DAMAGE_MULT = 1.5;
exports.VENGEANCE_DURATION_MS = 5 * 60 * 1000;
exports.VENGEANCE_DAMAGE_MULT = 1.15;
exports.BASE_PLAYER_MAX_HEALTH = 100;
/** Base death penalty: random 30–50% (then add sector %). */
exports.DEATH_PENALTY_BASE_PERCENT_MIN = 30;
exports.DEATH_PENALTY_BASE_PERCENT_MAX = 50;
/** Sector adds this % to base (grade 1–5). Total PvE = base + sector; PvP = (base + sector) * PVP_DEATH_PENALTY_EXTRA_MULT. */
exports.PVE_DEATH_PENALTY_PERCENT_BY_GRADE = {
    1: 2,
    2: 5,
    3: 8,
    4: 12,
    5: 15,
};
/** Same sector modifier for PvP; PvP then applies extra mult on top. */
exports.PVP_DEATH_PENALTY_PERCENT_BY_GRADE = {
    1: 2,
    2: 5,
    3: 8,
    4: 12,
    5: 15,
};
/** PvP death: total penalty is (base + sector) * this (50% more loss). */
exports.PVP_DEATH_PENALTY_EXTRA_MULT = 1.5;
exports.BASE_PLAYER_DAMAGE = 12;
exports.BASE_ENEMY_DAMAGE = 4;
exports.BASE_ENERGY_CAP = 10;
exports.ENERGY_CAP_PER_LEVEL = 3;
exports.MAX_PLAYER_LEVEL = 100;
exports.CHAT_HISTORY_LIMIT = 50;
exports.VENGEANCE_HUNTED_PUSH_INTERVAL_MS = 200;
exports.TICK_INTERVAL_MS = 100;
exports.SECTOR_NAMES = [
    "Aquila", "Vega", "Orion", "Cygnus", "Lyra", "Draco", "Perseus",
    "Auriga", "Phoenix", "Helios", "Arcturus", "Sirius", "Altair", "Rigel", "Deneb",
];
/** 1 = Easy (most black holes), 5 = Legendary (fewest). Only adjacent levels can be warp targets. */
exports.SECTOR_LEVELS = [1, 2, 3, 4, 5];
/** 25 секторов: 5 уровней × 5 секторов на уровень (только из БД). */
exports.TOTAL_PREDEFINED_SECTORS = 25;
/** Веса грейдов для порталов в соседний уровень: белый чаще, золотой реже. Индекс = грейд (1..5). */
exports.BLACK_HOLE_GRADE_WEIGHTS = {
    1: 1, // белый — чаще всего
    2: 0.5, // зелёный
    3: 1 / 3, // жёлтый
    4: 0.25, // фиолетовый
    5: 0.2, // золотой — реже всего
};
/** Вес цели «тот же уровень, другой грейд» (равновероятно среди 4 вариантов). */
exports.BLACK_HOLE_SAME_LEVEL_WEIGHT = 1;
/** Минимальный уровень игрока для входа в сектор данного уровня. */
exports.MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL = {
    1: 1,
    2: 25,
    3: 50,
    4: 75,
    5: 100,
};
exports.SECTOR_CONFIGS = {
    1: {
        level: 1,
        color: "#ffffff",
        namePrefix: "Easy",
        width: exports.WORLD_BASE_WIDTH * exports.LEVEL2_SIZE_MULTIPLIER,
        height: exports.WORLD_BASE_HEIGHT * exports.LEVEL2_SIZE_MULTIPLIER,
        enemyMinLevel: 1,
        enemyMaxLevel: 5,
        enemyTextures: ["enemy_blue_1", "enemy_red_2", "enemy_green_3", "enemy_black_4"],
        asteroidTextures: { big: ["meteor_big"], small: ["meteor_small"] },
        pvpAllowed: false,
        blackHoleSpawnWeight: 1,
    },
    2: {
        level: 2,
        color: "#2ecc71",
        namePrefix: "Normal",
        width: exports.WORLD_BASE_WIDTH * exports.LEVEL2_SIZE_MULTIPLIER,
        height: exports.WORLD_BASE_HEIGHT * exports.LEVEL2_SIZE_MULTIPLIER,
        enemyMinLevel: 5,
        enemyMaxLevel: 10,
        enemyTextures: ["enemy_blue_1", "enemy_red_2", "enemy_green_3", "enemy_black_4", "enemy_alt_blue"],
        asteroidTextures: { big: ["meteor_big"], small: ["meteor_small"] },
        pvpAllowed: true,
        blackHoleSpawnWeight: 0.75,
    },
    3: {
        level: 3,
        color: "#f1c40f",
        namePrefix: "Hard",
        width: exports.WORLD_BASE_WIDTH * exports.LEVEL2_SIZE_MULTIPLIER,
        height: exports.WORLD_BASE_HEIGHT * exports.LEVEL2_SIZE_MULTIPLIER,
        enemyMinLevel: 10,
        enemyMaxLevel: 15,
        enemyTextures: ["enemy_alt_blue", "enemy_alt_red", "enemy_alt_green", "enemy_alt_black"],
        asteroidTextures: { big: ["meteor_grey_big"], small: ["meteor_grey_small"] },
        pvpAllowed: true,
        blackHoleSpawnWeight: 0.5,
    },
    4: {
        level: 4,
        color: "#9b59b6",
        namePrefix: "Epic",
        width: exports.WORLD_BASE_WIDTH * exports.LEVEL2_SIZE_MULTIPLIER,
        height: exports.WORLD_BASE_HEIGHT * exports.LEVEL2_SIZE_MULTIPLIER,
        enemyMinLevel: 15,
        enemyMaxLevel: 20,
        enemyTextures: ["enemy_alt_blue", "enemy_alt_red", "enemy_alt_green", "enemy_alt_black"],
        asteroidTextures: { big: ["meteor_grey_big"], small: ["meteor_grey_small"] },
        pvpAllowed: true,
        blackHoleSpawnWeight: 0.3,
    },
    5: {
        level: 5,
        color: "#f39c12",
        namePrefix: "Legendary",
        width: exports.WORLD_BASE_WIDTH * exports.LEVEL2_SIZE_MULTIPLIER,
        height: exports.WORLD_BASE_HEIGHT * exports.LEVEL2_SIZE_MULTIPLIER,
        enemyMinLevel: 20,
        enemyMaxLevel: 25,
        enemyTextures: ["enemy_alt_blue", "enemy_alt_red", "enemy_alt_green", "enemy_alt_black"],
        asteroidTextures: { big: ["meteor_grey_big"], small: ["meteor_grey_small"] },
        pvpAllowed: true,
        blackHoleSpawnWeight: 0.15,
    },
};
exports.ENEMY_TYPE_LEVEL = {
    enemy_blue_1: 1,
    enemy_red_2: 2,
    enemy_green_3: 3,
    enemy_black_4: 4,
    enemy_alt_blue: 5,
    enemy_alt_red: 6,
    enemy_alt_green: 7,
    enemy_alt_black: 8,
};
exports.PLAYER_MONSTER_MODS = {
    keeper19: { maxHealth: 0.85, damage: 0.85 },
    keeper20: { maxHealth: 1.2, damage: 1.2 },
};
