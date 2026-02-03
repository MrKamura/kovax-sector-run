import { Injectable } from "@nestjs/common";
import {
  SECTOR_CONFIGS,
  SAFE_ZONE_RADIUS,
  SAFE_ZONE_DURATION_MS,
  SAFE_ZONE_COOLDOWN_MS,
  MAX_BLACK_HOLES_PER_SECTOR,
  BLACK_HOLE_DURATION_MS,
  BLACK_HOLE_APPEAR_DELAY_MS,
  SECTOR_CAPACITY,
  ENEMY_TYPE_LEVEL,
  WORLD_BASE_WIDTH,
  WORLD_BASE_HEIGHT,
  MAX_PICKUPS,
  ENEMY_COUNT,
  ASTEROID_COUNT,
} from "../config/constants";
import type { Sector, SectorWorld, BlackHoleState, SafeZoneState } from "./types";
import { PresenceService } from "./presence.service";
import {
  worldSeed,
  rand,
  randBetween,
  randInt,
  generateSectorName,
  enemyStatsForLevel,
} from "./utils";

@Injectable()
export class SectorService {
  readonly sectors = new Map<string, Sector>();

  constructor(private readonly presence: PresenceService) {
    this.createSector(1);
    this.createSector(1);
    this.createSector(2);
    this.createSector(2);
  }

  private createWorld(): SectorWorld {
    return {
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
    };
  }

  private getSectorCounts(sector: Sector) {
    const areaMult =
      (sector.config.width * sector.config.height) /
      (WORLD_BASE_WIDTH * WORLD_BASE_HEIGHT);
    return {
      pickups: Math.max(1, Math.round(MAX_PICKUPS * areaMult)),
      enemies: Math.max(1, Math.round(ENEMY_COUNT * areaMult)),
      asteroids: Math.max(1, Math.round(ASTEROID_COUNT * areaMult)),
    };
  }

  /** Random position across full sector (use Math.random so distribution is uniform). */
  private randomPositionInSector(
    width: number,
    height: number,
    margin: number
  ): { x: number; y: number } {
    const safeMargin = Math.min(margin, Math.floor(width * 0.05), Math.floor(height * 0.05));
    const minX = safeMargin;
    const maxX = Math.max(minX + 1, width - safeMargin);
    const minY = safeMargin;
    const maxY = Math.max(minY + 1, height - safeMargin);
    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  }

  private spawnPickup(
    sector: Sector,
    resource: string,
    x: number,
    y: number,
    amount?: number
  ): number {
    const id = sector.world.nextPickupId++;
    const pickup: { id: number; resource: string; x: number; y: number; amount?: number } = {
      id,
      resource,
      x,
      y,
    };
    if (resource === "tokens" && amount != null && amount > 0) pickup.amount = amount;
    sector.world.pickups.set(id, pickup);
    return id;
  }

  private spawnEnemy(sector: Sector): void {
    const id = sector.world.nextEnemyId++;
    const { width, height, enemyMinLevel, enemyMaxLevel, enemyTextures } = sector.config;
    const { x, y } = this.randomPositionInSector(width, height, 160);
    const texture =
      enemyTextures?.length > 0
        ? enemyTextures[randInt(0, enemyTextures.length - 1)]
        : "enemy_blue_1";
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
  }

  /** Public wrapper for respawn-after-kill (e.g. enemy_hit). */
  spawnEnemyPublic(sector: Sector): void {
    this.spawnEnemy(sector);
  }

  private spawnAsteroid(sector: Sector): void {
    const id = sector.world.nextAsteroidId++;
    const { width, height, asteroidTextures } = sector.config;
    const { x, y } = this.randomPositionInSector(width, height, 120);
    const textureList = id % 3 === 0 ? asteroidTextures?.small : asteroidTextures?.big;
    const texture =
      textureList?.length > 0
        ? textureList[randInt(0, textureList.length - 1)]
        : "meteor_big";
    const scale = randBetween(0.7, 1.2);
    sector.world.asteroids.set(id, { id, x, y, texture, scale });
  }

  private ensureWorldPopulation(sector: Sector): void {
    const { pickups, enemies, asteroids } = this.getSectorCounts(sector);
    const scrapCount = Array.from(sector.world.pickups.values()).filter(
      (p) => p.resource === "scrap"
    ).length;
    const neededScrap = Math.max(0, pickups - scrapCount);
    for (let i = 0; i < neededScrap; i++) {
      const { x, y } = this.randomPositionInSector(
        sector.config.width,
        sector.config.height,
        100
      );
      this.spawnPickup(sector, "scrap", x, y);
    }
    const neededEnemies = Math.max(0, enemies - sector.world.enemies.size);
    for (let i = 0; i < neededEnemies; i++) this.spawnEnemy(sector);
    const neededAsteroids = Math.max(0, asteroids - sector.world.asteroids.size);
    for (let i = 0; i < neededAsteroids; i++) this.spawnAsteroid(sector);
  }

  private createBlackHole(sector: Sector): void {
    if (!Array.isArray(sector.world.blackHoles)) sector.world.blackHoles = [];
    if (sector.world.blackHoles.length >= MAX_BLACK_HOLES_PER_SECTOR) return;
    const greenOrYellow = rand() < 0.5 ? 1 : 2;
    const targetSector = this.pickRandomSector(greenOrYellow, sector.id);
    if (!targetSector || targetSector.id === sector.id) return;
    const { x, y } = this.randomPositionInSector(
      sector.config.width,
      sector.config.height,
      140
    );
    const appearDelayMs = randBetween(0, BLACK_HOLE_APPEAR_DELAY_MS);
    const durationMs = BLACK_HOLE_DURATION_MS * (0.5 + rand());
    const now = Date.now();
    const appearsAt = now + appearDelayMs;
    const hole: BlackHoleState = {
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
  }

  ensureBlackHole(sector: Sector): void {
    if (!Array.isArray(sector.world.blackHoles)) sector.world.blackHoles = [];
    const now = Date.now();
    sector.world.blackHoles = sector.world.blackHoles.filter((h) => h.expiresAt > now);
    if (sector.world.blackHoles.length < MAX_BLACK_HOLES_PER_SECTOR) {
      this.createBlackHole(sector);
    }
  }

  private ensureSafeZone(sector: Sector): boolean {
    const now = Date.now();
    const zone = sector.world.safeZone;
    const lastMove = sector.world.lastSafeZoneMoveAt || 0;
    if (!zone) {
      sector.world.lastSafeZoneMoveAt = now;
      const { x: szX, y: szY } = this.randomPositionInSector(
        sector.config.width,
        sector.config.height,
        200
      );
      sector.world.safeZone = {
        id: `sz-${Date.now()}-${randInt(100, 999)}`,
        x: szX,
        y: szY,
        radius: SAFE_ZONE_RADIUS,
        expiresAt: now + SAFE_ZONE_DURATION_MS,
        color: sector.config.color,
      };
      return true;
    }
    if (zone.expiresAt <= now) {
      if (now - lastMove >= SAFE_ZONE_COOLDOWN_MS) {
        sector.world.lastSafeZoneMoveAt = now;
        const { x: szX, y: szY } = this.randomPositionInSector(
          sector.config.width,
          sector.config.height,
          200
        );
        sector.world.safeZone = {
          id: `sz-${Date.now()}-${randInt(100, 999)}`,
          x: szX,
          y: szY,
          radius: SAFE_ZONE_RADIUS,
          expiresAt: now + SAFE_ZONE_DURATION_MS,
          color: sector.config.color,
        };
        return true;
      }
      (zone as SafeZoneState).expiresAt = now + SAFE_ZONE_DURATION_MS;
    }
    return false;
  }

  getSectorsByLevel(level: number): Sector[] {
    return Array.from(this.sectors.values()).filter((s) => s.level === level);
  }

  pickRandomSector(level: number, excludeId?: string): Sector {
    const candidates = this.getSectorsByLevel(level).filter(
      (s) => !excludeId || s.id !== excludeId
    );
    if (candidates.length === 0) return this.createSector(level);
    return candidates[randInt(0, candidates.length - 1)];
  }

  createSector(level: number): Sector {
    const config = SECTOR_CONFIGS[level];
    if (!config) throw new Error(`Unknown sector level: ${level}`);
    const sectorId = `L${level}-${Date.now()}-${randInt(100, 999)}`;
    const sector: Sector = {
      id: sectorId,
      level,
      name: generateSectorName(level),
      config: { ...config },
      world: this.createWorld(),
      createdAt: Date.now(),
    };
    this.ensureWorldPopulation(sector);
    this.sectors.set(sectorId, sector);
    return sector;
  }

  findOrCreateSector(level: number, excludeId?: string, presence?: PresenceService): Sector {
    const presenceService = presence ?? this.presence;
    const candidates = this.getSectorsByLevel(level).filter((s) => s.id !== excludeId);
    let best: Sector | null = null;
    let bestCount = Infinity;
    for (const sector of candidates) {
      const count = presenceService.getSectorPlayerCount(sector.id);
      if (count < SECTOR_CAPACITY && count < bestCount) {
        best = sector;
        bestCount = count;
      }
    }
    return best ?? this.createSector(level);
  }

  isInsideSafeZone(zone: { x: number; y: number; radius: number } | null, x: number, y: number): boolean {
    if (!zone) return false;
    return Math.hypot(x - zone.x, y - zone.y) <= zone.radius;
  }

  isInsideGravityPit(
    pit: { x: number; y: number; radius: number; expiresAt: number } | null,
    x: number,
    y: number
  ): boolean {
    if (!pit || pit.expiresAt <= Date.now()) return false;
    return Math.hypot(x - pit.x, y - pit.y) <= pit.radius;
  }

  isInsideAnyGravityPit(
    pits: Array<{ x: number; y: number; radius: number; expiresAt: number }>,
    x: number,
    y: number
  ): boolean {
    const now = Date.now();
    for (const pit of pits) {
      if (pit.expiresAt <= now) continue;
      if (Math.hypot(x - pit.x, y - pit.y) <= pit.radius) return true;
    }
    return false;
  }

  getWorldSnapshot(sector: Sector) {
    const now = Date.now();
    const safeZone = sector.world.safeZone
      ? {
          ...sector.world.safeZone,
          movesAt: sector.world.lastSafeZoneMoveAt + SAFE_ZONE_COOLDOWN_MS,
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
      blackHoles: (sector.world.blackHoles || []).filter(
        (h) => (h.appearsAt ?? 0) <= now && h.expiresAt > now
      ),
      safeZone,
      pickups: Array.from(sector.world.pickups.values()),
      enemies: Array.from(sector.world.enemies.values()).map((e) => {
        const fallbackTexture = sector.config.enemyTextures?.[0] ?? "enemy_blue_1";
        return {
          id: e.id,
          x: e.x,
          y: e.y,
          rotation: e.rotation,
          texture: e.texture ?? fallbackTexture,
          level: e.level,
          damage: e.damage,
          health: e.health,
          maxHealth: e.maxHealth,
        };
      }),
      asteroids: Array.from(sector.world.asteroids.values()).map((a) => {
        const fallbackTexture =
          sector.config.asteroidTextures?.big?.[0] ?? "meteor_big";
        return {
          id: a.id,
          x: a.x,
          y: a.y,
          texture: a.texture ?? fallbackTexture,
          scale: a.scale ?? 1,
        };
      }),
      gravityPits: (sector.world.gravityPits || []).filter((p) => p.expiresAt > now),
    };
  }

  ensureSafeZoneForSector(sector: Sector): boolean {
    return this.ensureSafeZone(sector);
  }

  ensureWorldPopulationForSector(sector: Sector): void {
    this.ensureWorldPopulation(sector);
  }

  spawnPickupPublic(
    sector: Sector,
    resource: string,
    x: number,
    y: number,
    amount?: number
  ): number {
    return this.spawnPickup(sector, resource, x, y, amount);
  }
}
