require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const http = require("http");
const next = require("next");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");

const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required for presence server.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const presence = new Map();
const clients = new Map();
const CHAT_HISTORY_LIMIT = 50;

const originalLog = console.log;
console.log = (...args) => {
  const message = args.join(" ");
  if (message.includes("/ws") || message.toLowerCase().includes("websocket")) {
    return;
  }
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//.test(message)) {
    return;
  }
  originalLog(...args);
};

const WORLD_BASE_WIDTH = 2200;
const WORLD_BASE_HEIGHT = 1600;
const LEVEL2_SIZE_MULTIPLIER = 2;
const ENEMY_COUNT = 8;
const ENEMY_RESPAWN_MS = 12000;
const ENEMY_SPEED = 90;
const ENEMY_VISION_RANGE = 520;
const ENEMY_HEALTH = 90;
const ENEMY_ROAM_RADIUS = 260;
const MAX_PICKUPS = 12;
const PICKUP_RESPAWN_MS = 7000;
const ASTEROID_COUNT = 52;
const SECTOR_CAPACITY = 20;
const BLACK_HOLE_DURATION_MS = 60000; // 60 seconds
const BLACK_HOLE_APPEAR_DELAY_MS = 6000; // 0–6s random delay so holes don't all appear at once
const MAX_BLACK_HOLES_PER_SECTOR = 6;
const SAFE_ZONE_DURATION_MS = 60000;
const SAFE_ZONE_COOLDOWN_MS = 5 * 60 * 1000;
const SAFE_ZONE_RADIUS = 120;
const SAFE_ZONE_EXIT_IMMUNITY_MS = 5000; // 5 seconds of immunity after leaving safe zone
const GRAVITY_PIT_RADIUS = 180;
const GRAVITY_PIT_DURATION_MS = 5000;
const GRAVITY_PIT_SLOW = 0.35; // speed multiplier inside pit (mobs and players)
// Spawn immunity: invulnerable until first action, then countdown (so mobs don't kill on login).
const SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = 1e15; // Sentinel: invulnerable until first action
const SPAWN_IMMUNITY_AFTER_ACTION_MS = 5000; // 5 sec countdown after first action
// Safe exit: invulnerable during exit window, then save and close.
const EXIT_GRACE_SEC = 5;
const EXIT_GRACE_MS = EXIT_GRACE_SEC * 1000;
const FURY_DAMAGE_MULT = 1.5; // Fury skill: 50% more damage
const VENGEANCE_DURATION_MS = 5 * 60 * 1000; // Cycle of Vengeance: 5 min
const VENGEANCE_DAMAGE_MULT = 1.15; // +15% damage vs vengeance target
const BASE_PLAYER_MAX_HEALTH = 100;
const BASE_PLAYER_DAMAGE = 12;
// Enemy damage (comfortable: ~25 hits to kill L1 player).
const BASE_ENEMY_DAMAGE = 4;
const BASE_ENERGY_CAP = 10;
const ENERGY_CAP_PER_LEVEL = 3;
const MAX_PLAYER_LEVEL = 100;
const clampLevel = (level) => {
  const n = Number(level);
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_PLAYER_LEVEL, n));
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const worldSeed = Date.now() % 100000;
const rand = mulberry32(worldSeed);
const randBetween = (min, max) => min + (max - min) * rand();
const randInt = (min, max) =>
  Math.floor(randBetween(min, max + 1));

const expToNextLevel = (level) => 100 + Math.max(0, clampLevel(level) - 1) * 60;
const PLAYER_MONSTER_MODS = {
  keeper19: { maxHealth: 0.85, damage: 0.85 },
  keeper20: { maxHealth: 1.2, damage: 1.2 },
};
const playerStatsForLevel = (level, shipChoice) => {
  const safeLevel = clampLevel(level);
  const stats = {
    maxHealth: BASE_PLAYER_MAX_HEALTH + Math.max(0, safeLevel - 1) * 8,
    damage: BASE_PLAYER_DAMAGE + Math.max(0, safeLevel - 1) * 2,
  };
  const mod = shipChoice ? PLAYER_MONSTER_MODS[shipChoice] : null;
  if (!mod) {
    return stats;
  }
  return {
    maxHealth: Math.round(stats.maxHealth * mod.maxHealth),
    damage: Math.round(stats.damage * mod.damage),
  };
};
const normalizeMonsterChoice = (choice) =>
  choice === "keeper20" ? "keeper20" : "keeper19";
const getMonsterProgressEntry = (progress, key) => {
  if (!progress || typeof progress !== "object") {
    return null;
  }
  const entry = progress[key];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return entry;
};
const enemyStatsForLevel = (level) => ({
  maxHealth: ENEMY_HEALTH + Math.max(0, level - 1) * 40,
  damage: BASE_ENEMY_DAMAGE + Math.max(0, level - 1) * 1,
});
const energyCapForLevel = (level) =>
  BASE_ENERGY_CAP + Math.max(0, level - 1) * ENERGY_CAP_PER_LEVEL;

/** Tokens dropped by a mob when killed. Level 1 = 10, level 2+ increases. */
const tokensForMobLevel = (level) => {
  const L = Math.max(1, Number(level) || 1);
  return 10 + Math.max(0, L - 1) * 5;
};

const SECTOR_NAMES = [
  "Aquila",
  "Vega",
  "Orion",
  "Cygnus",
  "Lyra",
  "Draco",
  "Perseus",
  "Auriga",
  "Phoenix",
  "Helios",
  "Arcturus",
  "Sirius",
  "Altair",
  "Rigel",
  "Deneb",
];

const SECTOR_CONFIGS = {
  1: {
    level: 1,
    color: "#2ecc71",
    namePrefix: "Green",
    // Same size as yellow sector (2x width/height = 4x area).
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
    enemyMinLevel: 1,
    enemyMaxLevel: 3,
    enemyTextures: [
      "enemy_blue_1",
      "enemy_red_2",
      "enemy_green_3",
      "enemy_black_4",
    ],
    asteroidTextures: {
      big: ["meteor_big"],
      small: ["meteor_small"],
    },
  },
  2: {
    level: 2,
    color: "#f1c40f",
    namePrefix: "Yellow",
    width: WORLD_BASE_WIDTH * LEVEL2_SIZE_MULTIPLIER,
    height: WORLD_BASE_HEIGHT * LEVEL2_SIZE_MULTIPLIER,
    enemyMinLevel: 4,
    enemyMaxLevel: 8,
    enemyTextures: [
      "enemy_alt_blue",
      "enemy_alt_red",
      "enemy_alt_green",
      "enemy_alt_black",
    ],
    asteroidTextures: {
      big: ["meteor_grey_big"],
      small: ["meteor_grey_small"],
    },
  },
};

const ENEMY_TYPE_LEVEL = {
  // Green sector (L1): levels 1..3
  enemy_blue_1: 1,
  enemy_red_2: 2,
  enemy_green_3: 3,
  enemy_black_4: 3,
  // Yellow sector (L2): levels 4..8
  enemy_alt_blue: 4,
  enemy_alt_red: 5,
  enemy_alt_green: 6,
  enemy_alt_black: 8,
};

const createWorld = () => ({
  seed: worldSeed,
  pickups: new Map(),
  enemies: new Map(),
  asteroids: new Map(),
  blackHoles: [],
  safeZone: null,
  lastSafeZoneMoveAt: 0,
  gravityPits: [],
  nextPickupId: 1,
  nextEnemyId: 1,
  nextAsteroidId: 1,
});

const isInsideSafeZone = (zone, x, y) => {
  if (!zone) {
    return false;
  }
  const dx = x - zone.x;
  const dy = y - zone.y;
  return Math.hypot(dx, dy) <= zone.radius;
};

const isInsideGravityPit = (pit, x, y) => {
  if (!pit || pit.expiresAt <= Date.now()) return false;
  const dx = x - pit.x;
  const dy = y - pit.y;
  return Math.hypot(dx, dy) <= pit.radius;
};

const isInsideAnyGravityPit = (pits, x, y) => {
  if (!Array.isArray(pits)) return false;
  const now = Date.now();
  for (const pit of pits) {
    if (pit.expiresAt <= now) continue;
    const dx = x - pit.x;
    const dy = y - pit.y;
    if (Math.hypot(dx, dy) <= pit.radius) return true;
  }
  return false;
};

const sectors = new Map();

const spawnPickup = (sector, resource, x, y, amount) => {
  const id = sector.world.nextPickupId++;
  const pickup = { id, resource, x, y };
  if (resource === "tokens" && amount != null && amount > 0) {
    pickup.amount = amount;
  }
  sector.world.pickups.set(id, pickup);
  return id;
};

const spawnEnemy = (sector) => {
  const id = sector.world.nextEnemyId++;
  const { width, height, enemyMinLevel, enemyMaxLevel, enemyTextures } =
    sector.config;
  const x = randBetween(160, width - 160);
  const y = randBetween(160, height - 160);
  const texture = enemyTextures[randInt(0, enemyTextures.length - 1)];
  // Same mob type must not have different levels.
  const fixedLevel = ENEMY_TYPE_LEVEL[texture];
  const level = fixedLevel ?? randInt(enemyMinLevel, enemyMaxLevel);
  const stats = enemyStatsForLevel(level);
  sector.world.enemies.set(id, {
    id,
    x,
    y,
    rotation: 0,
    level,
    texture,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    damage: stats.damage,
    spawnX: x,
    spawnY: y,
    roamTargetX: x,
    roamTargetY: y,
    nextRoamAt: Date.now() + randBetween(800, 2000),
    updatedAt: Date.now(),
  });
};

const spawnAsteroid = (sector) => {
  const id = sector.world.nextAsteroidId++;
  const { width, height, asteroidTextures } = sector.config;
  const x = randBetween(120, width - 120);
  const y = randBetween(120, height - 120);
  const textureList =
    id % 3 === 0 ? asteroidTextures.small : asteroidTextures.big;
  const texture = textureList[randInt(0, textureList.length - 1)];
  const scale = randBetween(0.7, 1.2);
  sector.world.asteroids.set(id, {
    id,
    x,
    y,
    texture,
    scale,
  });
};

const getSectorCounts = (sector) => {
  const areaMult =
    (sector.config.width * sector.config.height) /
    (WORLD_BASE_WIDTH * WORLD_BASE_HEIGHT);
  return {
    pickups: Math.max(1, Math.round(MAX_PICKUPS * areaMult)),
    enemies: Math.max(1, Math.round(ENEMY_COUNT * areaMult)),
    asteroids: Math.max(1, Math.round(ASTEROID_COUNT * areaMult)),
  };
};

const ensureWorldPopulation = (sector) => {
  const { pickups, enemies, asteroids } = getSectorCounts(sector);
  const scrapCount = Array.from(sector.world.pickups.values()).filter(
    (pickup) => pickup.resource === "scrap"
  ).length;
  const neededScrap = Math.max(0, pickups - scrapCount);
  for (let i = 0; i < neededScrap; i += 1) {
    spawnPickup(
      sector,
      "scrap",
      randBetween(100, sector.config.width - 100),
      randBetween(100, sector.config.height - 100)
    );
  }
  const neededEnemies = Math.max(0, enemies - sector.world.enemies.size);
  for (let i = 0; i < neededEnemies; i += 1) {
    spawnEnemy(sector);
  }
  const neededAsteroids = Math.max(0, asteroids - sector.world.asteroids.size);
  for (let i = 0; i < neededAsteroids; i += 1) {
    spawnAsteroid(sector);
  }
};

const generateSectorName = (level) => {
  const base = SECTOR_NAMES[randInt(0, SECTOR_NAMES.length - 1)];
  return `${SECTOR_CONFIGS[level].namePrefix} L${level} • ${base}-${randInt(
    1,
    99
  )}`;
};

const createSector = (level) => {
  const config = SECTOR_CONFIGS[level];
  const sectorId = `L${level}-${Date.now()}-${randInt(100, 999)}`;
  const sector = {
    id: sectorId,
    level,
    name: generateSectorName(level),
    config,
    world: createWorld(),
    createdAt: Date.now(),
  };
  ensureWorldPopulation(sector);
  sectors.set(sectorId, sector);
  return sector;
};

const createBlackHole = (sector) => {
  if (!Array.isArray(sector.world.blackHoles)) {
    sector.world.blackHoles = [];
  }
  if (sector.world.blackHoles.length >= MAX_BLACK_HOLES_PER_SECTOR) {
    return;
  }
  const greenOrYellow = rand() < 0.5 ? 1 : 2;
  // Target must be a different sector, never the same one
  const targetSector = pickRandomSector(greenOrYellow, sector.id);
  if (targetSector.id === sector.id) {
    return;
  }
  const x = randBetween(140, sector.config.width - 140);
  const y = randBetween(140, sector.config.height - 140);
  // Each hole has its own appearance time (0–6s delay) and duration (50%–150% of base)
  const appearDelayMs = randBetween(0, BLACK_HOLE_APPEAR_DELAY_MS);
  const durationMs =
    BLACK_HOLE_DURATION_MS * (0.5 + rand());
  const now = Date.now();
  const appearsAt = now + appearDelayMs;
  const hole = {
    id: `bh-${now}-${randInt(100, 999)}`,
    x,
    y,
    type: "warp",
    targetSectorId: targetSector.id,
    targetSectorName: targetSector.name,
    targetLevel: targetSector.level,
    targetColor: targetSector.config.color,
    appearsAt,
    expiresAt: appearsAt + durationMs,
  };
  sector.world.blackHoles.push(hole);
};

const ensureBlackHole = (sector) => {
  if (!Array.isArray(sector.world.blackHoles)) {
    sector.world.blackHoles = [];
  }
  const now = Date.now();
  sector.world.blackHoles = sector.world.blackHoles.filter((h) => h.expiresAt > now);
  // Add at most one black hole per tick so each has its own appearance time (no simultaneous spawn)
  if (sector.world.blackHoles.length < MAX_BLACK_HOLES_PER_SECTOR) {
    createBlackHole(sector);
  }
};

const ensureSafeZone = (sector) => {
  const now = Date.now();
  const zone = sector.world.safeZone;
  const lastMove = Number(sector.world.lastSafeZoneMoveAt) || 0;
  
  // If no zone exists, create one immediately.
  if (!zone) {
    sector.world.lastSafeZoneMoveAt = now;
    sector.world.safeZone = {
      id: `sz-${Date.now()}-${randInt(100, 999)}`,
      x: randBetween(200, sector.config.width - 200),
      y: randBetween(200, sector.config.height - 200),
      radius: SAFE_ZONE_RADIUS,
      expiresAt: now + SAFE_ZONE_DURATION_MS,
      color: sector.config.color,
    };
    return true;
  }
  
  // If zone expired (60s at current position), move it if 5 minutes have passed.
  if (zone.expiresAt <= now) {
    const timeSinceLastMove = now - lastMove;
    if (timeSinceLastMove >= SAFE_ZONE_COOLDOWN_MS) {
      sector.world.lastSafeZoneMoveAt = now;
      sector.world.safeZone = {
        id: `sz-${Date.now()}-${randInt(100, 999)}`,
        x: randBetween(200, sector.config.width - 200),
        y: randBetween(200, sector.config.height - 200),
        radius: SAFE_ZONE_RADIUS,
        expiresAt: now + SAFE_ZONE_DURATION_MS,
        color: sector.config.color,
      };
      return true;
    }
    // Not time to move yet, but current position expired -> extend it briefly
    // (shouldn't happen, but safety net).
    zone.expiresAt = now + SAFE_ZONE_DURATION_MS;
    return false;
  }
  
  return false;
};

const getSectorsByLevel = (level) =>
  Array.from(sectors.values()).filter((sector) => sector.level === level);

const pickRandomSector = (level, excludeId) => {
  const candidates = getSectorsByLevel(level).filter((sector) =>
    excludeId ? sector.id !== excludeId : true
  );
  if (candidates.length === 0) {
    return createSector(level);
  }
  return candidates[randInt(0, candidates.length - 1)];
};

const getSectorPlayerCount = (sectorId) =>
  Array.from(presence.values()).filter((entry) => entry.sectorId === sectorId)
    .length;

const findOrCreateSector = (level, excludeId) => {
  const candidates = getSectorsByLevel(level).filter(
    (sector) => sector.id !== excludeId
  );
  let best = null;
  let bestCount = Infinity;
  for (const sector of candidates) {
    const count = getSectorPlayerCount(sector.id);
    if (count < SECTOR_CAPACITY && count < bestCount) {
      best = sector;
      bestCount = count;
    }
  }
  return best ?? createSector(level);
};

const movePlayerToSector = async (userId, nextLevel) => {
  const entry = presence.get(userId);
  if (!entry) {
    return;
  }
  const previousSector = sectors.get(entry.sectorId);
  const targetSector = findOrCreateSector(nextLevel, previousSector?.id);
  const spawnX = randBetween(120, targetSector.config.width - 120);
  const spawnY = randBetween(120, targetSector.config.height - 120);
  const zone = targetSector.world.safeZone;
  const initialInSafeZone = zone && zone.expiresAt > Date.now() && isInsideSafeZone(zone, spawnX, spawnY);
  entry.sectorId = targetSector.id;
  entry.x = spawnX;
  entry.y = spawnY;
  entry.rotation = 0;
  entry.invulnerableUntil = Date.now() + 10000;
  entry.updatedAt = Date.now();
  entry.wasInSafeZone = initialInSafeZone;
  presence.set(userId, entry);
  for (const socket of clients.get(userId) ?? []) {
    socket.sectorId = targetSector.id;
  }
  if (previousSector) {
    broadcastPresence(previousSector.id);
    broadcastWorld(previousSector.id);
  }
  broadcastPresence(targetSector.id);
  broadcastWorld(targetSector.id);
  notifyHuntersOfTargetSectorChange(userId);
  sendPlayerUpdate(userId, {
    posX: spawnX,
    posY: spawnY,
    rotation: 0,
    lastPositionAt: new Date().toISOString(),
  });
  sendSelfUpdate(userId, {
    serverTime: Date.now(),
    invulnerableUntil: entry.invulnerableUntil,
  });
  // Send sector chat history for the new sector (last 50).
  try {
    const messages = await loadChatHistory("sector", targetSector.id);
    const sockets = clients.get(userId);
    if (sockets) {
      const payload = JSON.stringify({
        type: "chat_history",
        scope: "sector",
        sectorId: targetSector.id,
        messages,
      });
      for (const socket of sockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      }
    }
  } catch {
    // ignore chat history load failures
  }
  try {
    await pool.query(
      `UPDATE players
       SET "posX" = $1,
           "posY" = $2,
           "rotation" = $3,
           "lastPositionAt" = NOW()
       WHERE "userId" = $4`,
      [spawnX, spawnY, 0, userId]
    );
  } catch (error) {
    console.error("Failed to persist sector travel:", error);
  }
};

const movePlayerToSectorById = async (userId, targetSectorId, fallbackLevel) => {
  const entry = presence.get(userId);
  if (!entry) {
    return;
  }
  const previousSector = sectors.get(entry.sectorId);
  const targetSector =
    sectors.get(targetSectorId) ??
    createSector(
      Number.isFinite(Number(fallbackLevel))
        ? Number(fallbackLevel)
        : (previousSector?.level ?? 1)
    );
  const spawnX = randBetween(120, targetSector.config.width - 120);
  const spawnY = randBetween(120, targetSector.config.height - 120);
  const zone = targetSector.world.safeZone;
  const initialInSafeZone = zone && zone.expiresAt > Date.now() && isInsideSafeZone(zone, spawnX, spawnY);
  entry.sectorId = targetSector.id;
  entry.x = spawnX;
  entry.y = spawnY;
  entry.rotation = 0;
  entry.invulnerableUntil = Date.now() + 10000;
  entry.updatedAt = Date.now();
  entry.wasInSafeZone = initialInSafeZone;
  presence.set(userId, entry);
  for (const socket of clients.get(userId) ?? []) {
    socket.sectorId = targetSector.id;
  }
  if (previousSector) {
    broadcastPresence(previousSector.id);
    broadcastWorld(previousSector.id);
  }
  broadcastPresence(targetSector.id);
  broadcastWorld(targetSector.id);
  notifyHuntersOfTargetSectorChange(userId);
  sendPlayerUpdate(userId, {
    posX: spawnX,
    posY: spawnY,
    rotation: 0,
    lastPositionAt: new Date().toISOString(),
  });
  sendSelfUpdate(userId, {
    serverTime: Date.now(),
    invulnerableUntil: entry.invulnerableUntil,
  });
  try {
    const messages = await loadChatHistory("sector", targetSector.id);
    const sockets = clients.get(userId);
    if (sockets) {
      const payload = JSON.stringify({
        type: "chat_history",
        scope: "sector",
        sectorId: targetSector.id,
        messages,
      });
      for (const socket of sockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      }
    }
  } catch {
    // ignore
  }
  try {
    await pool.query(
      `UPDATE players
       SET "posX" = $1,
           "posY" = $2,
           "rotation" = $3,
           "lastPositionAt" = NOW()
       WHERE "userId" = $4`,
      [spawnX, spawnY, 0, userId]
    );
  } catch (error) {
    console.error("Failed to persist sector travel:", error);
  }
};

// Ensure we always have multiple sectors of each tier to warp between.
createSector(1);
createSector(1);
createSector(2);
createSector(2);

const getWorldSnapshot = (sector) => {
  const safeZone = sector.world.safeZone
    ? {
        ...sector.world.safeZone,
        movesAt:
          Number(sector.world.lastSafeZoneMoveAt) + SAFE_ZONE_COOLDOWN_MS,
      }
    : null;
  return {
  seed: sector.world.seed,
  sector: {
    id: sector.id,
    name: sector.name,
    level: sector.level,
    color: sector.config.color,
    width: sector.config.width,
    height: sector.config.height,
  },
  blackHoles: Array.isArray(sector.world.blackHoles)
    ? sector.world.blackHoles.filter((h) => {
        const now = Date.now();
        return (h.appearsAt ?? 0) <= now && h.expiresAt > now;
      })
    : [],
  safeZone,
  pickups: Array.from(sector.world.pickups.values()),
  enemies: Array.from(sector.world.enemies.values()).map((enemy) => ({
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    rotation: enemy.rotation,
    texture: enemy.texture,
    level: enemy.level,
    damage: enemy.damage,
    health: enemy.health,
    maxHealth: enemy.maxHealth,
  })),
  asteroids: Array.from(sector.world.asteroids.values()),
  gravityPits: (sector.world.gravityPits || []).filter(
    (p) => p.expiresAt > Date.now()
  ),
  };
};

const broadcastWorld = (sectorId) => {
  const sector = sectors.get(sectorId);
  if (!sector) {
    return;
  }
  const payload = JSON.stringify({
    type: "world",
    serverTime: Date.now(),
    world: getWorldSnapshot(sector),
  });
  for (const sockets of clients.values()) {
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN && socket.sectorId === sectorId) {
        socket.send(payload);
      }
    }
  }
};

const parseCookies = (cookieHeader = "") => {
  const pairs = cookieHeader.split(";").map((value) => value.trim());
  const out = {};
  for (const pair of pairs) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
};

/** When a player changes sector, push fresh vengeance (target sector) to any hunters tracking them */
const notifyHuntersOfTargetSectorChange = (targetUserId) => {
  const targetEntry = presence.get(targetUserId);
  if (!targetEntry?.sectorId) return;
  const targetSector = sectors.get(targetEntry.sectorId);
  const now = Date.now();
  for (const entry of presence.values()) {
    if (
      entry.vengeanceTargetUserId !== targetUserId ||
      !entry.vengeanceExpiresAt ||
      entry.vengeanceExpiresAt <= now
    )
      continue;
    sendSelfUpdate(entry.userId, {
      vengeance: {
        targetUserId: entry.vengeanceTargetUserId,
        targetNickname: targetEntry.nickname ?? `Пилот ${targetUserId}`,
        expiresAt: entry.vengeanceExpiresAt,
        targetSectorId: targetEntry.sectorId,
        targetSectorName: targetSector?.name ?? null,
      },
    });
  }
};

const broadcastPresence = (sectorId) => {
  const now = Date.now();
  const players = Array.from(presence.values())
    .filter((entry) => entry.sectorId === sectorId && clients.has(entry.userId))
    .map((entry) => {
      const isHunted =
        entry.huntedByUserId != null &&
        typeof entry.huntedExpiresAt === "number" &&
        entry.huntedExpiresAt > now;
      return {
        ...entry,
        isHunted: !!isHunted,
        huntedExpiresAt: entry.huntedExpiresAt,
      };
    });
  const payload = JSON.stringify({
    type: "presence",
    serverTime: now,
    players,
  });
  for (const sockets of clients.values()) {
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN && socket.sectorId === sectorId) {
        socket.send(payload);
      }
    }
  }
};

const broadcastChat = (message, scope, sectorId) => {
  const payload = JSON.stringify({
    type: "chat_message",
    scope,
    sectorId,
    message,
  });
  for (const sockets of clients.values()) {
    for (const socket of sockets) {
      if (socket.readyState !== socket.OPEN) {
        continue;
      }
      if (scope === "global") {
        socket.send(payload);
        continue;
      }
      // Be defensive: ensure we can route sector messages even if socket.sectorId
      // wasn't attached (e.g. after deploy / custom ws wrappers).
      const socketSectorId =
        socket.sectorId ?? presence.get(socket.userId)?.sectorId;
      if (socketSectorId === sectorId) {
        socket.send(payload);
      }
    }
  }
};

const loadChatHistory = async (scope, sectorId) => {
  try {
    if (scope === "global") {
      const result = await pool.query(
        `SELECT id, user_id, nickname, text, created_at
         FROM chat_messages
         WHERE scope = 'global'
         ORDER BY created_at DESC
         LIMIT $1`,
        [CHAT_HISTORY_LIMIT]
      );
      return result.rows
        .map((row) => ({
          id: String(row.id),
          userId: Number(row.user_id),
          nickname: String(row.nickname),
          text: String(row.text),
          createdAt: Number(row.created_at),
        }))
        .reverse();
    }
    if (!sectorId) {
      return [];
    }
    const result = await pool.query(
      `SELECT id, user_id, nickname, text, created_at
       FROM chat_messages
       WHERE scope = 'sector' AND sector_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sectorId, CHAT_HISTORY_LIMIT]
    );
    return result.rows
      .map((row) => ({
        id: String(row.id),
        userId: Number(row.user_id),
        nickname: String(row.nickname),
        text: String(row.text),
        createdAt: Number(row.created_at),
      }))
      .reverse();
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

const persistChatMessage = async (message, scope, sectorId) => {
  try {
    await pool.query(
      `INSERT INTO chat_messages (id, scope, sector_id, user_id, nickname, text, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        message.id,
        scope,
        scope === "global" ? null : sectorId,
        message.userId,
        message.nickname,
        message.text,
        message.createdAt,
      ]
    );
  } catch (error) {
    console.error("Failed to persist chat message:", error);
  }
};

const sendPlayerUpdate = (userId, player) => {
  const sockets = clients.get(userId);
  if (!sockets) {
    return;
  }
  const payload = JSON.stringify({
    type: "player_update",
    player,
  });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
};

const sendDeathUpdate = (userId, death) => {
  const sockets = clients.get(userId);
  if (!sockets) {
    return;
  }
  const payload = JSON.stringify({
    type: "death",
    death,
  });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
};

const sendSelfUpdate = (userId, payload) => {
  const sockets = clients.get(userId);
  if (!sockets) {
    return;
  }
  const message = JSON.stringify({
    type: "self",
    ...payload,
  });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  }
};

/** If player is in "spawn immunity until first action", start the countdown and notify client. */
const startSpawnImmunityCountdownIfNeeded = (entry, userId) => {
  if (!entry || entry.invulnerableUntil < SPAWN_IMMUNITY_UNTIL_FIRST_ACTION) {
    return;
  }
  const now = Date.now();
  entry.invulnerableUntil = now + SPAWN_IMMUNITY_AFTER_ACTION_MS;
  presence.set(userId, entry);
  sendSelfUpdate(userId, { serverTime: now, invulnerableUntil: entry.invulnerableUntil });
};

const awardPlayerExp = async (userId, amount, shipChoice) => {
  if (!amount) {
    return null;
  }
  const monsterKey = normalizeMonsterChoice(shipChoice);
  const result = await pool.query(
    `SELECT level, exp, resources, "monsterProgress"
     FROM players
     WHERE "userId" = $1`,
    [userId]
  );
  if (result.rowCount === 0) {
    return null;
  }
  const progress = result.rows[0].monsterProgress || {};
  const stored = getMonsterProgressEntry(progress, monsterKey);
  const previousLevel = clampLevel(Number(stored?.level ?? result.rows[0].level) || 1);
  let level = previousLevel;
  let exp = Number(stored?.exp ?? result.rows[0].exp) || 0;
  let expToNext = expToNextLevel(level);
  if (level < MAX_PLAYER_LEVEL) {
    exp += amount;
    while (level < MAX_PLAYER_LEVEL && exp >= expToNext) {
      exp -= expToNext;
      level = clampLevel(level + 1);
      expToNext = expToNextLevel(level);
    }
    if (level >= MAX_PLAYER_LEVEL) {
      level = MAX_PLAYER_LEVEL;
      exp = 0;
      expToNext = expToNextLevel(level);
    }
  } else {
    level = MAX_PLAYER_LEVEL;
    exp = 0;
    expToNext = expToNextLevel(level);
  }
  const stats = playerStatsForLevel(level, monsterKey);
  const leveledUp = level > previousLevel;
  const health = leveledUp
    ? stats.maxHealth
    : Math.min(Number(stored?.health) || stats.maxHealth, stats.maxHealth);
  const nextProgress = {
    ...progress,
    [monsterKey]: {
      level,
      exp,
      expToNext,
      maxHealth: stats.maxHealth,
      damage: stats.damage,
      health,
    },
  };
  let nextResources = result.rows[0].resources || { scrap: 0, tokens: 0 };
  if (leveledUp) {
    const energyCap = energyCapForLevel(level);
    nextResources = {
      scrap: energyCap,
      tokens: Number(nextResources.tokens ?? 0) || 0,
    };
    await pool.query(
      `UPDATE players
       SET level = $1,
           exp = $2,
           "expToNext" = $3,
           "maxHealth" = $4,
           damage = $5,
           "monsterProgress" = $6,
           resources = $7
       WHERE "userId" = $8`,
      [level, exp, expToNext, stats.maxHealth, stats.damage, nextProgress, nextResources, userId]
    );
  } else {
    await pool.query(
      `UPDATE players
       SET level = $1,
           exp = $2,
           "expToNext" = $3,
           "maxHealth" = $4,
           damage = $5,
           "monsterProgress" = $6
       WHERE "userId" = $7`,
      [level, exp, expToNext, stats.maxHealth, stats.damage, nextProgress, userId]
    );
  }
  const out = {
    level,
    exp,
    expToNext,
    maxHealth: stats.maxHealth,
    damage: stats.damage,
    previousLevel,
  };
  if (leveledUp) {
    out.health = stats.maxHealth;
    out.resources = nextResources;
  }
  return out;
};

let lastWorldTick = Date.now();
const VENGEANCE_HUNTED_PUSH_INTERVAL_MS = 200;
const lastVengeanceHuntedPushByUser = new Map();

const tickWorld = () => {
  try {
    const now = Date.now();
    const dt = Math.min((now - lastWorldTick) / 1000, 0.2);
    lastWorldTick = now;
    for (const sector of sectors.values()) {
      ensureWorldPopulation(sector);
      ensureBlackHole(sector);
      ensureSafeZone(sector);
      // Remove expired gravity pits
      if (Array.isArray(sector.world.gravityPits)) {
        sector.world.gravityPits = sector.world.gravityPits.filter(
          (p) => p.expiresAt > now
        );
      }
      for (const enemy of sector.world.enemies.values()) {
        let target = null;
        let nearestDist = Infinity;
        for (const entry of presence.values()) {
          if (entry.isDead || entry.sectorId !== sector.id) {
            continue;
          }
          if (entry.invulnerableUntil && entry.invulnerableUntil > now) {
            continue;
          }
          if (isInsideSafeZone(sector.world.safeZone, entry.x, entry.y)) {
            continue;
          }
          const dx = entry.x - enemy.x;
          const dy = entry.y - enemy.y;
          const dist = Math.hypot(dx, dy);
          if (dist < nearestDist && dist <= ENEMY_VISION_RANGE) {
            nearestDist = dist;
            target = { dx, dy, dist };
          }
        }
        const inGravityPit = isInsideAnyGravityPit(
          sector.world.gravityPits,
          enemy.x,
          enemy.y
        );
        const enemySpeedMult = inGravityPit ? GRAVITY_PIT_SLOW : 1;
        if (target) {
          const nx = target.dx / (target.dist || 1);
          const ny = target.dy / (target.dist || 1);
          enemy.x += nx * ENEMY_SPEED * enemySpeedMult * dt;
          enemy.y += ny * ENEMY_SPEED * enemySpeedMult * dt;
          enemy.rotation = Math.atan2(ny, nx) + Math.PI / 2;
        } else {
          const nowMs = Date.now();
          const dx = enemy.roamTargetX - enemy.x;
          const dy = enemy.roamTargetY - enemy.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 100 || nowMs >= enemy.nextRoamAt) {
            const angle = randBetween(0, Math.PI * 2);
            const dist = randBetween(
              ENEMY_ROAM_RADIUS * 0.2,
              ENEMY_ROAM_RADIUS
            );
            enemy.roamTargetX = Math.min(
              sector.config.width - 80,
              Math.max(80, enemy.spawnX + Math.cos(angle) * dist)
            );
            enemy.roamTargetY = Math.min(
              sector.config.height - 80,
              Math.max(80, enemy.spawnY + Math.sin(angle) * dist)
            );
            enemy.nextRoamAt = nowMs + 1800;
          } else {
            const dist = Math.sqrt(distSq) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            enemy.x += nx * ENEMY_SPEED * 0.5 * enemySpeedMult * dt;
            enemy.y += ny * ENEMY_SPEED * 0.5 * enemySpeedMult * dt;
            enemy.rotation = Math.atan2(ny, nx) + Math.PI / 2;
          }
        }
        enemy.x = Math.min(
          sector.config.width - 80,
          Math.max(80, enemy.x)
        );
        enemy.y = Math.min(
          sector.config.height - 80,
          Math.max(80, enemy.y)
        );
        enemy.updatedAt = now;
      }

      // Safe zone regen boost and exit immunity (server-authoritative).
      const zone = sector.world.safeZone;
      if (zone && zone.expiresAt > now) {
        for (const entry of presence.values()) {
          if (entry.isDead || entry.sectorId !== sector.id) {
            continue;
          }
          const wasInSafeZone = entry.wasInSafeZone ?? false;
          const isInSafeZone = isInsideSafeZone(zone, entry.x, entry.y);
          
          // Grant immunity when exiting safe zone
          if (wasInSafeZone && !isInSafeZone) {
            entry.invulnerableUntil = now + SAFE_ZONE_EXIT_IMMUNITY_MS;
            entry.updatedAt = now;
            presence.set(entry.userId, entry);
            sendSelfUpdate(entry.userId, {
              invulnerableUntil: entry.invulnerableUntil,
            });
          }
          
          // Update tracking state
          entry.wasInSafeZone = isInSafeZone;
          
          if (!isInSafeZone) {
            continue;
          }
          
          const last = Number(entry.lastSafeZoneRegenAt ?? 0) || 0;
          if (now - last < 1000) {
            continue;
          }
          entry.lastSafeZoneRegenAt = now;
          if (Number(entry.health ?? 0) <= 0) {
            continue;
          }
          const maxHealth = Number(entry.maxHealth ?? 0) || 0;
          if (maxHealth <= 0) {
            continue;
          }
          const current = Number(entry.health) || 0;
          if (current >= maxHealth) {
            continue;
          }
          const heal = 4; // noticeably faster than passive regen
          const next = Math.min(maxHealth, current + heal);
          entry.health = next;
          entry.updatedAt = now;
          presence.set(entry.userId, entry);
          // Persist to DB + per-form progress to avoid snap-back.
          void (async () => {
            try {
              const res = await pool.query(
                `SELECT "monsterProgress" FROM players WHERE "userId" = $1`,
                [entry.userId]
              );
              const progress = res.rowCount ? res.rows[0].monsterProgress || {} : {};
              const key = normalizeMonsterChoice(entry.shipChoice);
              const stored = getMonsterProgressEntry(progress, key) || {};
              const nextProgress = {
                ...progress,
                [key]: { ...stored, health: next },
              };
              await pool.query(
                `UPDATE players
                 SET health = $1,
                     "lastHealthAt" = NOW(),
                     "monsterProgress" = $2
                 WHERE "userId" = $3`,
                [next, nextProgress, entry.userId]
              );
            } catch {
              // ignore
            }
          })();
        }
      } else {
        // No active safe zone - reset tracking for all players in this sector
        for (const entry of presence.values()) {
          if (entry.sectorId === sector.id) {
            entry.wasInSafeZone = false;
          }
        }
      }

      // Gravity pit: slow players inside (except the player who created the pit)
      for (const entry of presence.values()) {
        if (entry.isDead || entry.sectorId !== sector.id) continue;
        const pits = sector.world.gravityPits || [];
        const now = Date.now();
        let insidePitNotOwned = false;
        for (const pit of pits) {
          if (pit.expiresAt <= now) continue;
          if (pit.ownerUserId === entry.userId) continue;
          if (isInsideGravityPit(pit, entry.x, entry.y)) {
            insidePitNotOwned = true;
            break;
          }
        }
        entry.movementSpeedMultiplier = insidePitNotOwned ? GRAVITY_PIT_SLOW : 1;
      }

      // Healing skill: strong health regen while effect is active
      const HEALING_REGEN_PER_SEC = 25;
      for (const entry of presence.values()) {
        if (entry.isDead || entry.sectorId !== sector.id) continue;
        if (!entry.healingExpiresAt || entry.healingExpiresAt <= now) continue;
        const last = Number(entry.lastHealingRegenAt ?? 0) || 0;
        if (now - last < 1000) continue;
        entry.lastHealingRegenAt = now;
        const maxHealth = Number(entry.maxHealth ?? 0) || 0;
        if (maxHealth <= 0) continue;
        const current = Number(entry.health) || 0;
        if (current >= maxHealth) continue;
        const heal = Math.min(HEALING_REGEN_PER_SEC, maxHealth - current);
        const next = current + heal;
        entry.health = next;
        entry.updatedAt = now;
        presence.set(entry.userId, entry);
        sendPlayerUpdate(entry.userId, { health: next });
        void (async () => {
          try {
            const res = await pool.query(
              `SELECT "monsterProgress" FROM players WHERE "userId" = $1`,
              [entry.userId]
            );
            const progress = res.rowCount ? res.rows[0].monsterProgress || {} : {};
            const key = normalizeMonsterChoice(entry.shipChoice);
            const stored = getMonsterProgressEntry(progress, key) || {};
            const nextProgress = {
              ...progress,
              [key]: { ...stored, health: next },
            };
            await pool.query(
              `UPDATE players SET health = $1, "lastHealthAt" = NOW(), "monsterProgress" = $2 WHERE "userId" = $3`,
              [next, nextProgress, entry.userId]
            );
          } catch {
            // ignore
          }
        })();
      }

      // Fury skill: health regen while effect is active
      const FURY_REGEN_PER_SEC = 6;
      for (const entry of presence.values()) {
        if (entry.isDead || entry.sectorId !== sector.id) continue;
        if (!entry.furyExpiresAt || entry.furyExpiresAt <= now) continue;
        const last = Number(entry.lastFuryRegenAt ?? 0) || 0;
        if (now - last < 1000) continue;
        entry.lastFuryRegenAt = now;
        const maxHealth = Number(entry.maxHealth ?? 0) || 0;
        if (maxHealth <= 0) continue;
        const current = Number(entry.health) || 0;
        if (current >= maxHealth) continue;
        const heal = Math.min(FURY_REGEN_PER_SEC, maxHealth - current);
        const next = current + heal;
        entry.health = next;
        entry.updatedAt = now;
        presence.set(entry.userId, entry);
        sendPlayerUpdate(entry.userId, { health: next });
        void (async () => {
          try {
            const res = await pool.query(
              `SELECT "monsterProgress" FROM players WHERE "userId" = $1`,
              [entry.userId]
            );
            const progress = res.rowCount ? res.rows[0].monsterProgress || {} : {};
            const key = normalizeMonsterChoice(entry.shipChoice);
            const stored = getMonsterProgressEntry(progress, key) || {};
            const nextProgress = {
              ...progress,
              [key]: { ...stored, health: next },
            };
            await pool.query(
              `UPDATE players SET health = $1, "lastHealthAt" = NOW(), "monsterProgress" = $2 WHERE "userId" = $3`,
              [next, nextProgress, entry.userId]
            );
          } catch {
            // ignore
          }
        })();
      }

      broadcastWorld(sector.id);
    }

    // Vengeance & Hunted: clear expired and push via websocket so target sector tracks correctly and hunted debuff appears
    for (const entry of presence.values()) {
      const lastPush = lastVengeanceHuntedPushByUser.get(entry.userId) ?? 0;
      const shouldPush = now - lastPush >= VENGEANCE_HUNTED_PUSH_INTERVAL_MS;
      if (entry.vengeanceExpiresAt && entry.vengeanceTargetUserId) {
        if (entry.vengeanceExpiresAt <= now) {
          entry.vengeanceTargetUserId = undefined;
          entry.vengeanceExpiresAt = undefined;
          entry.updatedAt = now;
          presence.set(entry.userId, entry);
          sendSelfUpdate(entry.userId, { vengeance: null });
          lastVengeanceHuntedPushByUser.delete(entry.userId);
        } else if (shouldPush) {
          const targetEntry = presence.get(entry.vengeanceTargetUserId);
          const targetSector = targetEntry?.sectorId ? sectors.get(targetEntry.sectorId) : null;
          sendSelfUpdate(entry.userId, {
            vengeance: {
              targetUserId: entry.vengeanceTargetUserId,
              targetNickname: targetEntry?.nickname ?? `Пилот ${entry.vengeanceTargetUserId}`,
              expiresAt: entry.vengeanceExpiresAt,
              targetSectorId: targetEntry?.sectorId ?? null,
              targetSectorName: targetSector?.name ?? null,
            },
          });
          lastVengeanceHuntedPushByUser.set(entry.userId, now);
        }
      } else if (entry.huntedExpiresAt && entry.huntedByUserId) {
        if (entry.huntedExpiresAt <= now) {
          entry.huntedByUserId = undefined;
          entry.huntedExpiresAt = undefined;
          entry.updatedAt = now;
          presence.set(entry.userId, entry);
          sendSelfUpdate(entry.userId, { hunted: null });
          lastVengeanceHuntedPushByUser.delete(entry.userId);
        } else if (shouldPush) {
          const hunterEntry = presence.get(entry.huntedByUserId);
          sendSelfUpdate(entry.userId, {
            hunted: {
              hunterUserId: entry.huntedByUserId,
              hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
              expiresAt: entry.huntedExpiresAt,
            },
          });
          lastVengeanceHuntedPushByUser.set(entry.userId, now);
        }
      }
    }
  } catch (error) {
    console.error("World tick error:", error);
  }
};

const savePlayerPosition = async (entry) => {
  if (!entry) return;
  try {
    await pool.query(
      `UPDATE players
       SET "posX" = $1,
           "posY" = $2,
           "rotation" = $3,
           "lastPositionAt" = NOW()
       WHERE "userId" = $4`,
      [entry.x, entry.y, entry.rotation, entry.userId]
    );
  } catch (error) {
    console.error("Failed to save player position:", error);
  }
};

const resolveUser = async (token) => {
  if (!token) return null;
  const session = await pool.query(
    `SELECT "userId"
     FROM sessions
     WHERE token = $1
       AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`,
    [token]
  );
  if (session.rowCount === 0) return null;
  const userId = session.rows[0].userId;
  const user = await pool.query(
    `SELECT id, nickname, "shipChoice"
     FROM users
     WHERE id = $1`,
    [userId]
  );
  if (user.rowCount === 0) return null;
  return user.rows[0];
};

const setupPresence = (wss) => {
  wss.on("connection", async (socket, request) => {
    const cookieHeader = request.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);
    let user;
    try {
      user = await resolveUser(cookies.session);
    } catch (error) {
      console.error("Auth error:", error);
    }
    if (!user) {
      socket.close(1008, "Unauthorized");
      return;
    }

    const existingSockets = clients.get(user.id) ?? new Set();
    existingSockets.add(socket);
    clients.set(user.id, existingSockets);
    const existingPresence = presence.get(user.id);
    const assignedSector =
      sectors.get(existingPresence?.sectorId) ?? findOrCreateSector(1);
    socket.userId = user.id;
    socket.sectorId = assignedSector.id;
    let posX = existingPresence?.x ?? 0;
    let posY = existingPresence?.y ?? 0;
    let rotation = existingPresence?.rotation ?? 0;
    let health = existingPresence?.health ?? 100;
    let maxHealth = existingPresence?.maxHealth ?? 100;
    let level = existingPresence?.level ?? 1;
    let exp = 0;
    let expToNext = expToNextLevel(level);
    let damage = BASE_PLAYER_DAMAGE;
    const shouldSendPlayerUpdate = !existingPresence;
    if (!existingPresence) {
      try {
        const player = await pool.query(
          `SELECT "posX", "posY", "rotation", "health", "maxHealth", "level", "exp", "expToNext", "damage", "monsterProgress"
           FROM players
           WHERE "userId" = $1`,
          [user.id]
        );
        if (player.rowCount > 0) {
          posX = Number(player.rows[0].posX) || 0;
          posY = Number(player.rows[0].posY) || 0;
          rotation = Number(player.rows[0].rotation) || 0;
          const monsterKey = normalizeMonsterChoice(user.shipChoice);
          const progress = player.rows[0].monsterProgress || {};
          const stored = getMonsterProgressEntry(progress, monsterKey);
          if (stored) {
            level = Number(stored.level) || 1;
            exp = Number(stored.exp) || 0;
            expToNext =
              Number(stored.expToNext) || expToNextLevel(level);
            maxHealth = Number(stored.maxHealth) || playerStatsForLevel(level, monsterKey).maxHealth;
            damage = Number(stored.damage) || playerStatsForLevel(level, monsterKey).damage;
            health = Number(stored.health) || maxHealth;
          } else {
            level = Number(player.rows[0].level) || 1;
            exp = Number(player.rows[0].exp) || 0;
            expToNext =
              Number(player.rows[0].expToNext) || expToNextLevel(level);
            const stats = playerStatsForLevel(level, user.shipChoice);
            maxHealth = Number(player.rows[0].maxHealth) || stats.maxHealth;
            damage = Number(player.rows[0].damage) || stats.damage;
            health = Number(player.rows[0].health) || maxHealth;
            const nextProgress = {
              ...progress,
              [monsterKey]: {
                level,
                exp,
                expToNext,
                maxHealth,
                damage,
                health,
              },
            };
            await pool.query(
              `UPDATE players
               SET level = $1,
                   exp = $2,
                   "expToNext" = $3,
                   "maxHealth" = $4,
                   damage = $5,
                   health = $6,
                   "monsterProgress" = $7
               WHERE "userId" = $8`,
              [
                level,
                exp,
                expToNext,
                maxHealth,
                damage,
                health,
                nextProgress,
                user.id,
              ]
            );
          }
        }
      } catch (error) {
        console.error("Failed to load player position:", error);
      }
    } else {
      const stats = playerStatsForLevel(level, existingPresence?.shipChoice);
      maxHealth = maxHealth || stats.maxHealth;
      damage = stats.damage;
    }

    // On initial connect: invulnerable until first action, then countdown (prevents mobs killing on login).
    const invulnerableUntil = existingPresence
      ? (existingPresence.invulnerableUntil ?? 0)
      : SPAWN_IMMUNITY_UNTIL_FIRST_ACTION;
    const boundedX = Math.min(
      assignedSector.config.width - 120,
      Math.max(120, posX)
    );
    const boundedY = Math.min(
      assignedSector.config.height - 120,
      Math.max(120, posY)
    );
    const zone = assignedSector.world.safeZone;
    const initialInSafeZone = zone && zone.expiresAt > Date.now() && isInsideSafeZone(zone, boundedX, boundedY);
    const entry = {
      userId: user.id,
      nickname: user.nickname,
      shipChoice: user.shipChoice,
      x: boundedX,
      y: boundedY,
      rotation,
      health,
      maxHealth,
      firingAt: null,
      updatedAt: Date.now(),
      lastSavedAt: 0,
      invulnerableUntil,
      level,
      isDead: existingPresence?.isDead ?? health <= 0,
      sectorId: assignedSector.id,
      wasInSafeZone: initialInSafeZone,
      // Preserve vengeance/hunted on reconnect so buffs survive refresh
      vengeanceTargetUserId: existingPresence?.vengeanceTargetUserId,
      vengeanceExpiresAt: existingPresence?.vengeanceExpiresAt,
      huntedByUserId: existingPresence?.huntedByUserId,
      huntedExpiresAt: existingPresence?.huntedExpiresAt,
    };
    presence.set(user.id, entry);
    broadcastPresence(assignedSector.id);
    socket.send(
      JSON.stringify({
        type: "world",
        serverTime: Date.now(),
        world: getWorldSnapshot(assignedSector),
      })
    );
    const now = Date.now();
    const selfPayload = {
      type: "self",
      serverTime: now,
      invulnerableUntil,
    };
    if (existingPresence) {
      selfPayload.posX = entry.x;
      selfPayload.posY = entry.y;
      selfPayload.sectorId = entry.sectorId;
    }
    if (entry.vengeanceExpiresAt && entry.vengeanceTargetUserId && entry.vengeanceExpiresAt > now) {
      const targetEntry = presence.get(entry.vengeanceTargetUserId);
      const targetSector = targetEntry?.sectorId ? sectors.get(targetEntry.sectorId) : null;
      selfPayload.vengeance = {
        targetUserId: entry.vengeanceTargetUserId,
        targetNickname: targetEntry?.nickname ?? `Пилот ${entry.vengeanceTargetUserId}`,
        expiresAt: entry.vengeanceExpiresAt,
        targetSectorId: targetEntry?.sectorId ?? null,
        targetSectorName: targetSector?.name ?? null,
      };
    }
    if (entry.huntedExpiresAt && entry.huntedByUserId && entry.huntedExpiresAt > now) {
      const hunterEntry = presence.get(entry.huntedByUserId);
      selfPayload.hunted = {
        hunterUserId: entry.huntedByUserId,
        hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
        expiresAt: entry.huntedExpiresAt,
      };
    }
    socket.send(JSON.stringify(selfPayload));
    if (shouldSendPlayerUpdate) {
      sendPlayerUpdate(user.id, {
        level,
        exp,
        expToNext,
        maxHealth,
        damage,
      });
    }
    socket.send(
      JSON.stringify({
        type: "chat_history",
        scope: "sector",
        sectorId: assignedSector.id,
        messages: await loadChatHistory("sector", assignedSector.id),
      })
    );
    socket.send(
      JSON.stringify({
        type: "chat_history",
        scope: "global",
        messages: await loadChatHistory("global"),
      })
    );

    socket.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "update") {
          const next = presence.get(user.id);
          if (!next) return;
          const newX = Number(message.x) || next.x;
          const newY = Number(message.y) || next.y;
          const moved = newX !== next.x || newY !== next.y;
          if (moved) startSpawnImmunityCountdownIfNeeded(next, user.id);
          next.x = newX;
          next.y = newY;
          next.rotation = Number(message.rotation) || 0;
          if (message.shipChoice === "keeper19" || message.shipChoice === "keeper20") {
            next.shipChoice = message.shipChoice;
          }
          const level = Number(message.level);
          const health = Number(message.health);
          const maxHealth = Number(message.maxHealth);
          const firingAt =
            message.firingAt == null ? null : Number(message.firingAt ?? 0);
          if (Number.isFinite(health) && health >= 0) {
            next.health = health;
          }
          if (Number.isFinite(maxHealth) && maxHealth > 0) {
            next.maxHealth = maxHealth;
          }
          if (Number.isFinite(level) && level > 0) {
            next.level = level;
          }
          next.firingAt = Number.isFinite(firingAt) ? firingAt : null;
          next.updatedAt = Date.now();
          presence.set(user.id, next);
          if (next.sectorId) {
            broadcastPresence(next.sectorId);
          }
          const now = Date.now();
          if (now - next.lastSavedAt > 2000) {
            next.lastSavedAt = now;
            void savePlayerPosition(next);
          }
        }
        if (message.type === "player_dead") {
          const entry = presence.get(user.id);
          if (entry && !entry.isDead) {
            entry.isDead = true;
            entry.updatedAt = Date.now();
            presence.set(user.id, entry);
            if (entry.sectorId) {
              broadcastPresence(entry.sectorId);
            }
          }
        }
        if (message.type === "respawn" || message.type === "respawn_vengeance") {
          const entry = presence.get(user.id);
          if (!entry) {
            return;
          }
          const isVengeance = message.type === "respawn_vengeance";
          const vengeanceTargetUserId = isVengeance ? Number(message.killedByUserId) : null;
          const sector =
            sectors.get(entry.sectorId) ?? findOrCreateSector(1);
          entry.sectorId = sector.id;
          const spawnX = randBetween(120, sector.config.width - 120);
          const spawnY = randBetween(120, sector.config.height - 120);
          const rotation = 0;
          const monsterKey = normalizeMonsterChoice(entry?.shipChoice);
          let level = entry.level || 1;
          let exp = 0;
          let expToNext = expToNextLevel(level);
          let resources = { scrap: 0, tokens: 0 };
          const expResult = await pool.query(
            `SELECT exp, "expToNext", resources, "monsterProgress"
             FROM players
             WHERE "userId" = $1`,
            [user.id]
          );
          if (expResult.rowCount > 0) {
            const progress = expResult.rows[0].monsterProgress || {};
            const stored = getMonsterProgressEntry(progress, monsterKey);
            if (stored) {
              level = Number(stored.level) || level;
              exp = Number(stored.exp) || 0;
              expToNext =
                Number(stored.expToNext) || expToNextLevel(level);
            } else {
              exp = Number(expResult.rows[0].exp) || 0;
              expToNext =
                Number(expResult.rows[0].expToNext) || expToNextLevel(level);
            }
            resources = expResult.rows[0].resources || resources;
          }
          const stats = playerStatsForLevel(level, monsterKey);
          const energyCap = energyCapForLevel(level);
          const nextResources = {
            scrap: energyCap,
            tokens: Number(resources.tokens || 0),
          };
          const progress = expResult.rowCount > 0 ? expResult.rows[0].monsterProgress || {} : {};
          const nextProgress = {
            ...progress,
            [monsterKey]: {
              level,
              exp,
              expToNext,
              maxHealth: stats.maxHealth,
              damage: stats.damage,
              health: stats.maxHealth,
            },
          };
          await pool.query(
            `UPDATE players
             SET "posX" = $1,
                 "posY" = $2,
                 "rotation" = $3,
                 "lastPositionAt" = NOW(),
                 "lastHealthAt" = NOW(),
                 "health" = $4,
                 "maxHealth" = $5,
                 resources = $6,
                 "monsterProgress" = $7
             WHERE "userId" = $8`,
            [
              spawnX,
              spawnY,
              rotation,
              stats.maxHealth,
              stats.maxHealth,
              nextResources,
              nextProgress,
              user.id,
            ]
          );
          const invulnerableUntil = Date.now() + 10000;
          const zone = sector.world.safeZone;
          const initialInSafeZone = zone && zone.expiresAt > Date.now() && isInsideSafeZone(zone, spawnX, spawnY);
          entry.x = spawnX;
          entry.y = spawnY;
          entry.rotation = rotation;
          entry.health = stats.maxHealth;
          entry.maxHealth = stats.maxHealth;
          entry.level = level;
          entry.invulnerableUntil = invulnerableUntil;
          entry.isDead = false;
          entry.updatedAt = Date.now();
          entry.wasInSafeZone = initialInSafeZone;
          if (isVengeance && Number.isFinite(vengeanceTargetUserId) && vengeanceTargetUserId > 0) {
            entry.vengeanceTargetUserId = vengeanceTargetUserId;
            entry.vengeanceExpiresAt = Date.now() + VENGEANCE_DURATION_MS;
            // Hunter should not see the victim buff; clear any hunted state and tell client
            entry.huntedByUserId = undefined;
            entry.huntedExpiresAt = undefined;
          } else {
            entry.vengeanceTargetUserId = undefined;
            entry.vengeanceExpiresAt = undefined;
          }
          presence.set(user.id, entry);
          for (const socket of clients.get(user.id) ?? []) {
            socket.sectorId = sector.id;
          }
          if (entry.vengeanceExpiresAt && entry.vengeanceTargetUserId) {
            const targetUserId = entry.vengeanceTargetUserId;
            const targetEntry = presence.get(targetUserId);
            const targetSector = targetEntry?.sectorId ? sectors.get(targetEntry.sectorId) : null;
            sendSelfUpdate(user.id, {
              vengeance: {
                targetUserId,
                targetNickname: targetEntry?.nickname ?? `Пилот ${targetUserId}`,
                expiresAt: entry.vengeanceExpiresAt,
                targetSectorId: targetEntry?.sectorId ?? null,
                targetSectorName: targetSector?.name ?? null,
              },
              hunted: null,
            });
            // Apply hunted buff to the target so both hunter and hunted share the same countdown
            if (targetEntry) {
              targetEntry.huntedByUserId = user.id;
              targetEntry.huntedExpiresAt = entry.vengeanceExpiresAt;
              targetEntry.updatedAt = Date.now();
              presence.set(targetUserId, targetEntry);
              const hunterNickname = entry.nickname ?? user.nickname ?? `Пилот ${user.id}`;
              const huntedPayload = {
                hunted: {
                  hunterUserId: user.id,
                  hunterNickname,
                  expiresAt: entry.vengeanceExpiresAt,
                },
              };
              sendSelfUpdate(targetUserId, huntedPayload);
              lastVengeanceHuntedPushByUser.delete(targetUserId);
              [200, 600, 1200].forEach((ms) => {
                setTimeout(() => {
                  const e = presence.get(targetUserId);
                  if (e?.huntedByUserId === user.id && e?.huntedExpiresAt > Date.now()) {
                    sendSelfUpdate(targetUserId, huntedPayload);
                  }
                }, ms);
              });
              if (targetEntry.sectorId) {
                broadcastPresence(targetEntry.sectorId);
              }
            }
          }
          if (entry.huntedExpiresAt && entry.huntedByUserId && entry.huntedExpiresAt > Date.now()) {
            const hunterEntry = presence.get(entry.huntedByUserId);
            sendSelfUpdate(user.id, {
              hunted: {
                hunterUserId: entry.huntedByUserId,
                hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
                expiresAt: entry.huntedExpiresAt,
              },
            });
          }
          // Ensure client sees the correct sector chat after respawn/relocation.
          try {
            const messages = await loadChatHistory("sector", sector.id);
            const sockets = clients.get(user.id);
            if (sockets) {
              const payload = JSON.stringify({
                type: "chat_history",
                scope: "sector",
                sectorId: sector.id,
                messages,
              });
              for (const socket of sockets) {
                if (socket.readyState === socket.OPEN) {
                  socket.send(payload);
                }
              }
            }
          } catch {
            // ignore
          }
          broadcastPresence(sector.id);
          broadcastWorld(sector.id);
          sendPlayerUpdate(user.id, {
            level,
            exp,
            expToNext,
            maxHealth: stats.maxHealth,
            damage: stats.damage,
            health: stats.maxHealth,
            resources: nextResources,
            posX: spawnX,
            posY: spawnY,
            rotation,
            lastPositionAt: new Date().toISOString(),
          });
          sendSelfUpdate(user.id, {
            serverTime: Date.now(),
            invulnerableUntil,
          });
        }
        if (message.type === "use_black_hole") {
          const entry = presence.get(user.id);
          if (!entry) {
            return;
          }
          startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = sectors.get(entry.sectorId);
          const holes = Array.isArray(sector?.world.blackHoles)
            ? sector.world.blackHoles
            : [];
          if (!sector || holes.length === 0) {
            return;
          }
          const blackHoleId = message.blackHoleId;
          let hole =
            typeof blackHoleId === "string" &&
            holes.find((h) => h.id === blackHoleId);
          if (!hole) {
            const now = Date.now();
            let nearestDist = Infinity;
            for (const h of holes) {
              if (h.expiresAt <= now || (h.appearsAt ?? 0) > now) continue;
              const dist = Math.hypot(entry.x - h.x, entry.y - h.y);
              if (dist <= 90 && dist < nearestDist) {
                nearestDist = dist;
                hole = h;
              }
            }
          }
          const now = Date.now();
          if (!hole || hole.expiresAt <= now || (hole.appearsAt ?? 0) > now) {
            return;
          }
          const dx = entry.x - hole.x;
          const dy = entry.y - hole.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 90) {
            return;
          }
          const targetSectorId = hole.targetSectorId;
          const targetLevel = Number(hole.targetLevel);
          if (targetSectorId === entry.sectorId) {
            return;
          }
          if (targetSectorId && Number.isFinite(targetLevel)) {
            if (sector.level === 1 && targetLevel === 2 && (entry.level || 1) < 3) {
              return;
            }
          }
          sector.world.blackHoles = sector.world.blackHoles.filter(
            (h) => h.id !== hole.id
          );
          broadcastWorld(sector.id);
          if (targetSectorId && Number.isFinite(targetLevel)) {
            await movePlayerToSectorById(user.id, targetSectorId, targetLevel);
            return;
          }
          await movePlayerToSector(user.id, sector.level);
        }
        if (message.type === "pickup_collect") {
          const pickupId = Number(message.pickupId);
          const entry = presence.get(user.id);
          if (entry) startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          if (!sector) {
            return;
          }
          const pickup = sector.world.pickups.get(pickupId);
          if (pickup) {
            sector.world.pickups.delete(pickupId);
            if (pickup.resource === "tokens" && (pickup.amount == null || pickup.amount > 0)) {
              const addTokens = Math.max(1, Number(pickup.amount) || 1);
              try {
                const res = await pool.query(
                  `SELECT resources FROM players WHERE "userId" = $1`,
                  [user.id]
                );
                if (res.rowCount > 0) {
                  const resources = res.rows[0].resources || { scrap: 0, tokens: 0 };
                  const nextResources = {
                    ...resources,
                    tokens: (Number(resources.tokens ?? 0) || 0) + addTokens,
                  };
                  await pool.query(
                    `UPDATE players SET resources = $1 WHERE "userId" = $2`,
                    [nextResources, user.id]
                  );
                  sendPlayerUpdate(user.id, { resources: nextResources });
                }
              } catch (err) {
                console.error("Failed to grant token pickup:", err);
              }
            } else if (pickup.resource !== "tokens") {
              setTimeout(() => {
                spawnPickup(
                  sector,
                  pickup.resource,
                  randBetween(100, sector.config.width - 100),
                  randBetween(100, sector.config.height - 100)
                );
                broadcastWorld(sector.id);
              }, PICKUP_RESPAWN_MS);
            }
            broadcastWorld(sector.id);
          }
        }
        if (message.type === "skill_immunity") {
          const entry = presence.get(user.id);
          if (entry) startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          const zone = sector?.world?.safeZone;
          if (
            entry &&
            (!zone || zone.expiresAt <= Date.now() || !isInsideSafeZone(zone, entry.x, entry.y))
          ) {
            const durationMs = Math.min(10000, Math.max(1000, Number(message.durationMs) || 5000));
            entry.invulnerableUntil = Date.now() + durationMs;
            broadcastPresence(entry.sectorId);
            sendSelfUpdate(user.id, {
              serverTime: Date.now(),
              invulnerableUntil: entry.invulnerableUntil,
            });
          }
        }
        if (message.type === "skill_healing") {
          const entry = presence.get(user.id);
          if (entry) startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          const zone = sector?.world?.safeZone;
          if (
            entry &&
            (!zone || zone.expiresAt <= Date.now() || !isInsideSafeZone(zone, entry.x, entry.y))
          ) {
            const durationMs = Math.min(10000, Math.max(1000, Number(message.durationMs) || 5000));
            entry.healingExpiresAt = Date.now() + durationMs;
            entry.lastHealingRegenAt = 0;
            broadcastPresence(entry.sectorId);
          }
        }
        if (message.type === "skill_fury") {
          const entry = presence.get(user.id);
          if (entry) startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          const zone = sector?.world?.safeZone;
          if (
            entry &&
            (!zone || zone.expiresAt <= Date.now() || !isInsideSafeZone(zone, entry.x, entry.y))
          ) {
            const durationMs = Math.min(15000, Math.max(1000, Number(message.durationMs) || 7000));
            entry.furyExpiresAt = Date.now() + durationMs;
            broadcastPresence(entry.sectorId);
          }
        }
        if (message.type === "skill_gravity_pit") {
          const entry = presence.get(user.id);
          if (entry) startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          const zone = sector?.world?.safeZone;
          if (
            entry &&
            sector &&
            (!zone || zone.expiresAt <= Date.now() || !isInsideSafeZone(zone, entry.x, entry.y))
          ) {
            const width = sector.config.width;
            const height = sector.config.height;
            const margin = 100;
            // Place pit at player position so it appears where they activated it
            let x = Math.min(width - margin, Math.max(margin, entry.x));
            let y = Math.min(height - margin, Math.max(margin, entry.y));
            if (!Array.isArray(sector.world.gravityPits)) {
              sector.world.gravityPits = [];
            }
            const pit = {
              id: `gp-${Date.now()}-${randInt(100, 999)}`,
              x,
              y,
              radius: GRAVITY_PIT_RADIUS,
              expiresAt: Date.now() + GRAVITY_PIT_DURATION_MS,
              ownerUserId: user.id,
            };
            sector.world.gravityPits.push(pit);
            broadcastWorld(entry.sectorId);
          }
        }
        if (message.type === "skill_teleport") {
          const entry = presence.get(user.id);
          if (entry) startSpawnImmunityCountdownIfNeeded(entry, user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          const zone = sector?.world?.safeZone;
          if (
            entry &&
            sector &&
            (!zone || zone.expiresAt <= Date.now() || !isInsideSafeZone(zone, entry.x, entry.y))
          ) {
            const width = sector.config.width;
            const height = sector.config.height;
            const margin = 120;
            setTimeout(() => {
              const current = presence.get(user.id);
              const currentSector = current ? sectors.get(current.sectorId) : null;
              if (!current || !currentSector || currentSector.id !== sector.id) {
                return;
              }
              const x = randBetween(margin, width - margin);
              const y = randBetween(margin, height - margin);
              current.x = x;
              current.y = y;
              current.updatedAt = Date.now();
              presence.set(user.id, current);
              broadcastPresence(current.sectorId);
              try {
                socket.send(
                  JSON.stringify({
                    type: "teleport_complete",
                    x,
                    y,
                  })
                );
              } catch {
                // client may have disconnected
              }
            }, 3000);
          }
        }
        if (message.type === "enemy_hit") {
          const enemyId = Number(message.enemyId);
          const requestedDamage = Math.max(0, Number(message.damage || 0));
          const presenceEntry = presence.get(user.id);
          if (presenceEntry) startSpawnImmunityCountdownIfNeeded(presenceEntry, user.id);
          const level = presenceEntry?.level || 1;
          const maxDamage = playerStatsForLevel(level, presenceEntry?.shipChoice).damage;
          const continuousLaser = Boolean(message.continuousLaser);
          const damageCap = continuousLaser ? maxDamage * 3 : maxDamage;
          let damage = Math.min(requestedDamage || 0, damageCap);
          const now = Date.now();
          if (presenceEntry?.furyExpiresAt && presenceEntry.furyExpiresAt > now) {
            damage = Math.round(damage * FURY_DAMAGE_MULT);
          }
          const sector = presenceEntry
            ? sectors.get(presenceEntry.sectorId)
            : null;
          if (!sector) {
            return;
          }
          const enemy = sector.world.enemies.get(enemyId);
          if (enemy && damage > 0) {
            enemy.health = Math.max(0, enemy.health - damage);
            if (enemy.health <= 0) {
              sector.world.enemies.delete(enemyId);
              const expGain = Math.max(1, Math.floor((25 + enemy.level * 10) / 5));
              const tokenAmount = tokensForMobLevel(enemy.level);
              const tokenId = spawnPickup(sector, "tokens", enemy.x, enemy.y, tokenAmount);
              broadcastWorld(sector.id);
              setTimeout(() => {
                spawnEnemy(sector);
                broadcastWorld(sector.id);
              }, ENEMY_RESPAWN_MS);
              setTimeout(() => {
                if (sector.world.pickups.delete(tokenId)) {
                  broadcastWorld(sector.id);
                }
              }, PICKUP_RESPAWN_MS);
              try {
                const progress = await awardPlayerExp(
                  user.id,
                  expGain,
                  presenceEntry?.shipChoice
                );
                if (progress) {
                  sendPlayerUpdate(user.id, progress);
                  if (presenceEntry) {
                    presenceEntry.level = progress.level;
                    presenceEntry.maxHealth = progress.maxHealth;
                    if (typeof progress.health === "number") {
                      presenceEntry.health = progress.health;
                    }
                  }
                  if (progress.previousLevel != null && progress.level > progress.previousLevel) {
                    try {
                      const nickname = presenceEntry?.nickname ?? "Игрок";
                      const chatEntry = {
                        id: `level-${Date.now()}-${user.id}`,
                        userId: user.id,
                        nickname: "Система",
                        text: `${nickname} достиг уровня ${progress.level}.`,
                        createdAt: Date.now(),
                      };
                      await persistChatMessage(chatEntry, "global");
                      broadcastChat(chatEntry, "global");
                    } catch {
                      // ignore chat notification failures
                    }
                  }
                }
              } catch (error) {
                console.error("Failed to award exp:", error);
              }
            } else {
              broadcastWorld(sector.id);
            }
          }
        }
        if (message.type === "player_hit") {
          const targetUserId = Number(message.targetUserId);
          if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
            return;
          }
          const attacker = presence.get(user.id);
          const victim = presence.get(targetUserId);
          if (!attacker || !victim) {
            return;
          }
          if (attacker.isDead || victim.isDead) {
            return;
          }
          if (!attacker.sectorId || attacker.sectorId !== victim.sectorId) {
            return;
          }
          const sector = sectors.get(attacker.sectorId);
          if (sector && sector.world.safeZone) {
            // PvP is disabled in immunity zones (attacker OR victim inside).
            if (
              isInsideSafeZone(sector.world.safeZone, attacker.x, attacker.y) ||
              isInsideSafeZone(sector.world.safeZone, victim.x, victim.y)
            ) {
              return;
            }
          }
          const now = Date.now();
          if (victim.invulnerableUntil && victim.invulnerableUntil > now) {
            return;
          }
          const requestedDamage = Math.max(0, Number(message.damage || 0));
          const maxDamage = playerStatsForLevel(attacker.level || 1, attacker.shipChoice).damage;
          const continuousLaser = Boolean(message.continuousLaser);
          const damageCap = continuousLaser ? maxDamage * 3 : maxDamage;
          let damage = Math.min(requestedDamage || 0, damageCap);
          if (attacker.furyExpiresAt && attacker.furyExpiresAt > now) {
            damage = Math.round(damage * FURY_DAMAGE_MULT);
          }
          if (attacker.vengeanceTargetUserId === targetUserId && attacker.vengeanceExpiresAt > now) {
            damage = Math.round(damage * VENGEANCE_DAMAGE_MULT);
          }
          if (!damage) {
            return;
          }

          // Load victim's canonical state from DB.
          const victimRow = await pool.query(
            `SELECT health, exp, resources, "monsterProgress"
             FROM players
             WHERE "userId" = $1`,
            [targetUserId]
          );
          if (victimRow.rowCount === 0) {
            return;
          }
          const storedHealth = Number(victimRow.rows[0].health);
          const currentHealth = Number.isFinite(storedHealth)
            ? storedHealth
            : Number(victim.health || 0);
          // Fury (rage) mode: victim cannot die, health floors at 1
          const victimInFury = victim.furyExpiresAt && victim.furyExpiresAt > now;
          const minHealth = victimInFury ? 1 : 0;
          const nextHealth = Math.max(minHealth, currentHealth - damage);

          let resources = victimRow.rows[0].resources || { scrap: 0, tokens: 0 };
          const tokens = Number(resources.tokens ?? 0) || 0;
          let exp = Number(victimRow.rows[0].exp ?? 0) || 0;

          const progress = victimRow.rows[0].monsterProgress || {};
          const victimMonsterKey = normalizeMonsterChoice(victim.shipChoice);
          const storedProgress = getMonsterProgressEntry(progress, victimMonsterKey) || {};
          const nextProgress = {
            ...progress,
            [victimMonsterKey]: {
              ...storedProgress,
              exp,
              health: nextHealth,
            },
          };

          let death = null;
          const diedNow = currentHealth > 0 && nextHealth === 0;
          if (diedNow) {
            const tokenPercent = (Math.max(1, Math.floor(Math.random() * 30) + 1)) / 100;
            const expPercent = (Math.max(1, Math.floor(Math.random() * 30) + 1)) / 100;
            let lostTokens = Math.floor(tokens * tokenPercent);
            let lostExp = Math.floor(exp * expPercent);
            if (tokens > 0 && lostTokens === 0) {
              lostTokens = 1;
            }
            if (exp > 0 && lostExp === 0) {
              lostExp = 1;
            }
            resources = { ...resources, tokens: Math.max(0, tokens - lostTokens) };
            exp = Math.max(0, exp - lostExp);
            death = {
              lostTokens,
              lostExp,
              killedBy: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
              killedByUserId: user.id,
            };

            // Sector kill flash: brief message at top for all in sector
            const broadcastToSector = (sid, payload) => {
              const p = JSON.stringify(payload);
              for (const sockets of clients.values()) {
                for (const socket of sockets) {
                  if (socket.readyState === socket.OPEN && socket.sectorId === sid) {
                    socket.send(p);
                  }
                }
              }
            };
            broadcastToSector(attacker.sectorId, {
              type: "sector_kill_flash",
              killerName: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
              victimName: victim.nickname ?? `Пилот ${targetUserId}`,
            });

            // System chat notification (global): "who killed who"
            try {
              const killerName =
                attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`;
              const victimName = victim.nickname ?? `Пилот ${targetUserId}`;
              const chatEntry = {
                id: `${Date.now()}-pvp-${user.id}-${targetUserId}`,
                userId: user.id,
                nickname: "Система",
                text: `${killerName} убил ${victimName}.`,
                createdAt: Date.now(),
              };
              await persistChatMessage(chatEntry, "global");
              broadcastChat(chatEntry, "global");
            } catch {
              // ignore chat notification failures
            }

            // Award killer: tokens + EXP stolen from the victim.
            try {
              if (lostTokens > 0) {
                const killerRow = await pool.query(
                  `SELECT resources FROM players WHERE "userId" = $1`,
                  [user.id]
                );
                const killerResources = killerRow.rowCount
                  ? killerRow.rows[0].resources || { scrap: 0, tokens: 0 }
                  : { scrap: 0, tokens: 0 };
                const killerTokens = Number(killerResources.tokens ?? 0) || 0;
                killerResources.tokens = killerTokens + lostTokens;
                await pool.query(
                  `UPDATE players SET resources = $1 WHERE "userId" = $2`,
                  [killerResources, user.id]
                );
                sendPlayerUpdate(user.id, { resources: killerResources });
              }
              if (lostExp > 0) {
                const progress = await awardPlayerExp(
                  user.id,
                  lostExp,
                  attacker.shipChoice
                );
                if (progress) {
                  sendPlayerUpdate(user.id, progress);
                  attacker.level = progress.level;
                  attacker.maxHealth = progress.maxHealth;
                  if (typeof progress.health === "number") {
                    attacker.health = progress.health;
                  }
                  presence.set(user.id, attacker);
                  if (progress.previousLevel != null && progress.level > progress.previousLevel) {
                    try {
                      const killerName = attacker.nickname ?? "Игрок";
                      const chatEntry = {
                        id: `level-${Date.now()}-${user.id}-pvp`,
                        userId: user.id,
                        nickname: "Система",
                        text: `${killerName} достиг уровня ${progress.level}.`,
                        createdAt: Date.now(),
                      };
                      await persistChatMessage(chatEntry, "global");
                      broadcastChat(chatEntry, "global");
                    } catch {
                      // ignore chat notification failures
                    }
                  }
                }
              }
            } catch (error) {
              console.error("Failed to award PvP rewards:", error);
            }

            victim.isDead = true;
          }

          // Persist victim health/exp/resources + per-form progress health/exp.
          try {
            const persistProgress = {
              ...progress,
              [victimMonsterKey]: {
                ...storedProgress,
                exp,
                health: nextHealth,
              },
            };
            await pool.query(
              `UPDATE players
               SET health = $1,
                   "lastHealthAt" = NOW(),
                   exp = $2,
                   resources = $3,
                   "monsterProgress" = $4
               WHERE "userId" = $5`,
              [nextHealth, exp, resources, persistProgress, targetUserId]
            );
          } catch (error) {
            console.error("Failed to persist PvP damage:", error);
          }

          victim.health = nextHealth;
          victim.updatedAt = Date.now();
          if (death) {
            // Hunter killed their vengeance target: clear both buffs
            if (attacker.vengeanceTargetUserId === targetUserId) {
              attacker.vengeanceTargetUserId = undefined;
              attacker.vengeanceExpiresAt = undefined;
              attacker.updatedAt = Date.now();
              presence.set(user.id, attacker);
              sendSelfUpdate(user.id, { vengeance: null });
              lastVengeanceHuntedPushByUser.delete(user.id);
            }
            // Victim was hunted by this killer: hunt complete, clear victim's hunted (both buffs gone)
            if (victim.huntedByUserId === user.id) {
              victim.huntedByUserId = undefined;
              victim.huntedExpiresAt = undefined;
              sendSelfUpdate(targetUserId, { hunted: null });
              lastVengeanceHuntedPushByUser.delete(targetUserId);
            } else {
              victim.huntedByUserId = user.id;
              victim.huntedExpiresAt = Date.now() + VENGEANCE_DURATION_MS;
            }
          }
          presence.set(targetUserId, victim);
          broadcastPresence(attacker.sectorId);
          sendPlayerUpdate(targetUserId, { health: nextHealth, exp, resources });
          // So the victim can show a laser coming at them (server-authoritative position)
          const broadcastToSectorPayload = (sid, payload) => {
            const p = JSON.stringify(payload);
            for (const sockets of clients.values()) {
              for (const socket of sockets) {
                if (socket.readyState === socket.OPEN && socket.sectorId === sid) {
                  socket.send(p);
                }
              }
            }
          };
          broadcastToSectorPayload(attacker.sectorId, {
            type: "player_shot_result",
            attackerUserId: user.id,
            victimUserId: targetUserId,
            attackerX: attacker.x,
            attackerY: attacker.y,
          });
          if (death) {
            sendDeathUpdate(targetUserId, death);
            if (victim.huntedByUserId != null && victim.huntedExpiresAt != null) {
              const hunterNickname = attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`;
              const huntedPayload = {
                hunted: {
                  hunterUserId: victim.huntedByUserId,
                  hunterNickname,
                  expiresAt: victim.huntedExpiresAt,
                },
              };
              sendSelfUpdate(targetUserId, huntedPayload);
              lastVengeanceHuntedPushByUser.delete(targetUserId);
              [200, 600, 1200].forEach((ms) => {
                setTimeout(() => {
                  const v = presence.get(targetUserId);
                  if (v?.huntedByUserId != null && v?.huntedExpiresAt > Date.now()) {
                    sendSelfUpdate(targetUserId, huntedPayload);
                  }
                }, ms);
              });
            }
          }
        }
        if (message.type === "asteroid_destroy") {
          const asteroidId = Number(message.asteroidId);
          const entry = presence.get(user.id);
          const sector = entry ? sectors.get(entry.sectorId) : null;
          if (sector && sector.world.asteroids.delete(asteroidId)) {
            broadcastWorld(sector.id);
          }
        }
        if (message.type === "chat_message") {
          const text = String(message.text ?? "").trim();
          if (!text) {
            return;
          }
          const safeText = text.slice(0, 240);
          const scope = message.scope === "global" ? "global" : "sector";
          const entry = presence.get(user.id);
          const sectorId = entry?.sectorId ?? "unknown";
          const nickname =
            entry?.nickname ?? user.nickname ?? `Пилот ${user.id}`;
          const chatEntry = {
            id: `${Date.now()}-${user.id}`,
            userId: user.id,
            nickname,
            text: safeText,
            createdAt: Date.now(),
          };
          await persistChatMessage(chatEntry, scope, sectorId);
          broadcastChat(chatEntry, scope, sectorId);
        }
        if (message.type === "request_exit") {
          const entry = presence.get(user.id);
          if (entry) {
            const now = Date.now();
            entry.invulnerableUntil = Math.max(
              entry.invulnerableUntil || 0,
              now + EXIT_GRACE_MS + 1000
            );
            presence.set(user.id, entry);
            broadcastPresence(entry.sectorId);
            sendSelfUpdate(user.id, { serverTime: now, invulnerableUntil: entry.invulnerableUntil });
            setTimeout(async () => {
              const current = presence.get(user.id);
              if (current) {
                await savePlayerPosition(current);
              }
              try {
                socket.send(JSON.stringify({ type: "exit_ready" }));
              } catch {
                // client may already be gone
              }
              socket.close(1000);
            }, EXIT_GRACE_MS);
          } else {
            socket.close(1000);
          }
        }
        if (message.type === "disconnect") {
          socket.close(1000);
        }
      } catch {
        // ignore invalid messages
      }
    });

    socket.on("close", () => {
      const socketSet = clients.get(user.id);
      if (socketSet) {
        socketSet.delete(socket);
        if (socketSet.size === 0) {
          clients.delete(user.id);
          const last = presence.get(user.id);
          // Keep presence entry so vengeance/hunted survive refresh; only remove from clients
          void savePlayerPosition(last);
          if (last?.sectorId) {
            broadcastPresence(last.sectorId);
          }
        } else {
          clients.set(user.id, socketSet);
        }
      }
    });
  });
};

const app = next({ dev, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const upgradeHandler = app.getUpgradeHandler();
    const server = http.createServer((req, res) => handle(req, res));
    const wss = new WebSocketServer({ noServer: true });
    setupPresence(wss);
    server.on("upgrade", (request, socket, head) => {
      if (request.url && request.url.startsWith("/ws")) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        // Let Next.js handle its own upgrade routes (e.g. dev HMR at /_next/webpack-hmr).
        upgradeHandler(request, socket, head).catch(() => {
          try {
            socket.destroy();
          } catch {
            // ignore
          }
        });
      }
    });

    server.listen(port, () => {
      console.log(`Server ready on http://localhost:${port}`);
    });
    setInterval(tickWorld, 100);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
