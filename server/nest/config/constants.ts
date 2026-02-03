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
  }
> = {
  1: {
    level: 1,
    color: "#2ecc71",
    namePrefix: "Green",
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
    enemyMinLevel: 1,
    enemyMaxLevel: 3,
    enemyTextures: ["enemy_blue_1", "enemy_red_2", "enemy_green_3", "enemy_black_4"],
    asteroidTextures: { big: ["meteor_big"], small: ["meteor_small"] },
  },
  2: {
    level: 2,
    color: "#f1c40f",
    namePrefix: "Yellow",
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
    enemyMinLevel: 4,
    enemyMaxLevel: 8,
    enemyTextures: ["enemy_alt_blue", "enemy_alt_red", "enemy_alt_green", "enemy_alt_black"],
    asteroidTextures: { big: ["meteor_grey_big"], small: ["meteor_grey_small"] },
  },
};

export const ENEMY_TYPE_LEVEL: Record<string, number> = {
  enemy_blue_1: 1,
  enemy_red_2: 2,
  enemy_green_3: 3,
  enemy_black_4: 3,
  enemy_alt_blue: 4,
  enemy_alt_red: 5,
  enemy_alt_green: 6,
  enemy_alt_black: 8,
};

export const PLAYER_MONSTER_MODS: Record<string, { maxHealth: number; damage: number }> = {
  keeper19: { maxHealth: 0.85, damage: 0.85 },
  keeper20: { maxHealth: 1.2, damage: 1.2 },
};
