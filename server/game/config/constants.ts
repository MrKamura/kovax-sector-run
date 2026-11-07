export const WORLD_BASE_WIDTH = 2200;
export const WORLD_BASE_HEIGHT = 1600;
export const LEVEL2_SIZE_MULTIPLIER = 2;
export const ENEMY_COUNT = 8;
export const ENEMY_RESPAWN_MS = 12000;
export const ENEMY_SPEED = 90;
export const ENEMY_VISION_RANGE = 520;
export const ENEMY_HEALTH = 90;
export const ENEMY_ROAM_RADIUS = 260;
export const MAX_PICKUPS = 12;
export const PICKUP_RESPAWN_MS = 7000;
export const ASTEROID_COUNT = 52;
export const SECTOR_CAPACITY = 20;
export const BLACK_HOLE_DURATION_MS = 60000;
export const BLACK_HOLE_APPEAR_DELAY_MS = 6000;
export const MAX_BLACK_HOLES_PER_SECTOR = 6;
export const SAFE_ZONE_DURATION_MS = 60000;
export const SAFE_ZONE_COOLDOWN_MS = 5 * 60 * 1000;
export const SAFE_ZONE_RADIUS = 120;
export const SAFE_ZONE_EXIT_IMMUNITY_MS = 5000;
export const GRAVITY_PIT_RADIUS = 180;
export const GRAVITY_PIT_DURATION_MS = 5000;
export const GRAVITY_PIT_SLOW = 0.35;
export const SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = 1e15;
export const SPAWN_IMMUNITY_AFTER_ACTION_MS = 5000;
export const EXIT_GRACE_SEC = 5;
export const EXIT_GRACE_MS = EXIT_GRACE_SEC * 1000;
export const FURY_DAMAGE_MULT = 1.5;
export const VENGEANCE_DURATION_MS = 5 * 60 * 1000;
export const VENGEANCE_DAMAGE_MULT = 1.15;
export const BASE_PLAYER_MAX_HEALTH = 100;

/** Base death penalty: random 30–50% (then add sector %). */
export const DEATH_PENALTY_BASE_PERCENT_MIN = 30;
export const DEATH_PENALTY_BASE_PERCENT_MAX = 50;

/** Sector adds this % to base (grade 1–5). Total PvE = base + sector; PvP = (base + sector) * PVP_DEATH_PENALTY_EXTRA_MULT. */
export const PVE_DEATH_PENALTY_PERCENT_BY_GRADE: Record<number, number> = {
  1: 2,
  2: 5,
  3: 8,
  4: 12,
  5: 15,
};

/** Same sector modifier for PvP; PvP then applies extra mult on top. */
export const PVP_DEATH_PENALTY_PERCENT_BY_GRADE: Record<number, number> = {
  1: 2,
  2: 5,
  3: 8,
  4: 12,
  5: 15,
};

/** PvP death: total penalty is (base + sector) * this (50% more loss). */
export const PVP_DEATH_PENALTY_EXTRA_MULT = 1.5;
export const BASE_PLAYER_DAMAGE = 12;
export const BASE_ENEMY_DAMAGE = 4;
export const BASE_ENERGY_CAP = 10;
export const ENERGY_CAP_PER_LEVEL = 3;
export const MAX_PLAYER_LEVEL = 100;
export const CHAT_HISTORY_LIMIT = 50;
export const VENGEANCE_HUNTED_PUSH_INTERVAL_MS = 200;
export const TICK_INTERVAL_MS = 100;

export const SECTOR_NAMES = [
  "Aquila", "Vega", "Orion", "Cygnus", "Lyra", "Draco", "Perseus",
  "Auriga", "Phoenix", "Helios", "Arcturus", "Sirius", "Altair", "Rigel", "Deneb",
];

/** 1 = Easy (most black holes), 5 = Legendary (fewest). Only adjacent levels can be warp targets. */
export const SECTOR_LEVELS = [1, 2, 3, 4, 5] as const;
/** 25 секторов: 5 уровней × 5 секторов на уровень (только из БД). */
export const TOTAL_PREDEFINED_SECTORS = 25;

/** Веса грейдов для порталов в соседний уровень: белый чаще, золотой реже. Индекс = грейд (1..5). */
export const BLACK_HOLE_GRADE_WEIGHTS: Record<number, number> = {
  1: 1,      // белый — чаще всего
  2: 0.5,    // зелёный
  3: 1 / 3,  // жёлтый
  4: 0.25,   // фиолетовый
  5: 0.2,    // золотой — реже всего
};
/** Вес цели «тот же уровень, другой грейд» (равновероятно среди 4 вариантов). */
export const BLACK_HOLE_SAME_LEVEL_WEIGHT = 1;

/** Минимальный уровень игрока для входа в сектор данного уровня. */
export const MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL: Record<number, number> = {
  1: 1,
  2: 25,
  3: 50,
  4: 75,
  5: 100,
};

export const SECTOR_CONFIGS: Record<
  number,
  {
    level: number;
    color: string;
    namePrefix: string;
    width: number;
    height: number;
    enemyMinLevel: number;
    enemyMaxLevel: number;
    enemyTextures: string[];
    asteroidTextures: { big: string[]; small: string[] };
    pvpAllowed: boolean;
    /** 0..1, higher = black holes spawn more often in this sector. Easy=1, Legendary=lowest. */
    blackHoleSpawnWeight: number;
  }
> = {
  1: {
    level: 1,
    color: "#ffffff",
    namePrefix: "Easy",
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
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
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
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
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
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
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
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
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
    enemyMinLevel: 20,
    enemyMaxLevel: 25,
    enemyTextures: ["enemy_alt_blue", "enemy_alt_red", "enemy_alt_green", "enemy_alt_black"],
    asteroidTextures: { big: ["meteor_grey_big"], small: ["meteor_grey_small"] },
    pvpAllowed: true,
    blackHoleSpawnWeight: 0.15,
  },
};

export const ENEMY_TYPE_LEVEL: Record<string, number> = {
  enemy_blue_1: 1,
  enemy_red_2: 2,
  enemy_green_3: 3,
  enemy_black_4: 4,
  enemy_alt_blue: 5,
  enemy_alt_red: 6,
  enemy_alt_green: 7,
  enemy_alt_black: 8,
};

export const PLAYER_MONSTER_MODS: Record<string, { maxHealth: number; damage: number }> = {
  keeper19: { maxHealth: 0.85, damage: 0.85 },
  keeper20: { maxHealth: 1.2, damage: 1.2 },
};
