import { Injectable } from "@nestjs/common";
import {
  SECTOR_CONFIGS,
  BLACK_HOLE_GRADE_WEIGHTS,
  BLACK_HOLE_SAME_LEVEL_WEIGHT,
  MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL,
  SECTOR_CAPACITY,
  SAFE_ZONE_RADIUS,
  SAFE_ZONE_DURATION_MS,
  SAFE_ZONE_COOLDOWN_MS,
  MAX_BLACK_HOLES_PER_SECTOR,
  BLACK_HOLE_DURATION_MS,
  BLACK_HOLE_APPEAR_DELAY_MS,
  ENEMY_TYPE_LEVEL,
  WORLD_BASE_WIDTH,
  WORLD_BASE_HEIGHT,
  MAX_PICKUPS,
  ENEMY_COUNT,
  ASTEROID_COUNT,
  DEATH_PENALTY_BASE_PERCENT_MIN,
  DEATH_PENALTY_BASE_PERCENT_MAX,
  PVE_DEATH_PENALTY_PERCENT_BY_GRADE,
  PVP_DEATH_PENALTY_EXTRA_MULT,
} from "../config/constants";
import type { Sector, SectorWorld, BlackHoleState, SafeZoneState } from "./types";
import { PresenceService } from "./presence.service";
import { DbService } from "./db.service";
import {
  worldSeed,
  rand,
  randBetween,
  randInt,
  enemyStatsForLevel,
} from "./utils";

@Injectable()
export class SectorService {
  readonly sectors = new Map<string, Sector>();

  constructor(
    private readonly presence: PresenceService,
    private readonly db: DbService,
  ) {}

  /** Загружает все секторы из БД. Никакой генерации — только чтение. Список 25 секторов задаётся миграцией. */
  async loadSectorsFromDb(db?: DbService): Promise<void> {
    const dbService = db ?? this.db;
    if (!dbService?.Sector) {
      throw new Error("DbService (with Sector model) is required for loadSectorsFromDb.");
    }
    const rows = await dbService.Sector.findAll({ order: [["id", "ASC"]] });
    for (const row of rows) {
      this.instantiateSector(row.id, row.name, row.level);
    }
  }

  /** Название титула (грейда) для описания. */
  private static getGradeTitle(grade: number): string {
    const titles: Record<number, string> = {
      1: "Белый",
      2: "Зелёный",
      3: "Жёлтый",
      4: "Фиолетовый",
      5: "Золотой",
    };
    return titles[Math.max(1, Math.min(5, grade))] ?? "Сектор";
  }

  /** Грейд из id: Lx-01 -> 1, Lx-02 -> 2, ... (1=белый, 5=золотой). */
  private static gradeFromId(id: string): number {
    const match = id.match(/-0?(\d)$/);
    const g = match ? parseInt(match[1], 10) : 1;
    return Math.max(1, Math.min(5, g));
  }

  private instantiateSector(id: string, name: string, level: unknown): void {
    const safeLevel = SectorService.normalizeSectorLevel(level);
    const grade = SectorService.gradeFromId(id);
    const configByGrade = SECTOR_CONFIGS[grade];
    if (!configByGrade) return;
    const config = {
      ...configByGrade,
      enemyMinLevel: grade === 1 ? 1 : (grade - 1) * 5,
      enemyMaxLevel: grade * 5,
    };
    const sector: Sector = {
      id,
      level: safeLevel,
      grade,
      name,
      config: { ...config },
      world: this.createWorld(),
      createdAt: Date.now(),
    };
    this.ensureWorldPopulation(sector);
    this.sectors.set(id, sector);
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
    const minLvl = Math.max(1, enemyMinLevel ?? 1);
    const maxLvl = Math.min(100, enemyMaxLevel ?? 5);
    const { x, y } = this.randomPositionInSector(width, height, 160);
    const texture =
      enemyTextures?.length > 0
        ? enemyTextures[randInt(0, enemyTextures.length - 1)]
        : "enemy_blue_1";
    const fixedLevel = ENEMY_TYPE_LEVEL[texture];
    const rawLevel = fixedLevel ?? randInt(minLvl, maxLvl);
    const level = Math.max(minLvl, Math.min(maxLvl, rawLevel));
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

  private static normalizeSectorLevel(level: unknown): number {
    const n = Number(level);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(5, Math.floor(n)));
  }

  /** Цели портала: тот же уровень (другие грейды) + соседние уровни (все грейды). Соседние уровни взвешены по грейду из BLACK_HOLE_GRADE_WEIGHTS. */
  private getTargetLevelGradePairs(current: Sector): { level: number; grade: number; weight: number }[] {
    const L = SectorService.normalizeSectorLevel(current.level);
    const G = Math.max(1, Math.min(5, current.grade ?? SectorService.gradeFromId(current.id)));
    const out: { level: number; grade: number; weight: number }[] = [];
    const sameWeight = BLACK_HOLE_SAME_LEVEL_WEIGHT;
    const gradeWeight = (g: number) => BLACK_HOLE_GRADE_WEIGHTS[g] ?? 1 / Math.max(1, g);
    for (let g = 1; g <= 5; g++) {
      if (g !== G) out.push({ level: L, grade: g, weight: sameWeight });
    }
    if (L < 5) {
      for (let g = 1; g <= 5; g++) {
        out.push({ level: L + 1, grade: g, weight: gradeWeight(g) });
      }
    }
    if (L > 1) {
      for (let g = 1; g <= 5; g++) {
        out.push({ level: L - 1, grade: g, weight: gradeWeight(g) });
      }
    }
    return out;
  }

  /** Вероятность выбора пары (level, grade) в процентах (0–100). */
  private getTargetProbabilityPercent(
    pairs: { level: number; grade: number; weight: number }[],
    targetLevel: number,
    targetGrade: number
  ): number {
    const total = pairs.reduce((a, p) => a + p.weight, 0);
    if (total <= 0) return 0;
    const p = pairs.find((x) => x.level === targetLevel && x.grade === targetGrade);
    if (!p) return 0;
    return Math.round((p.weight / total) * 100);
  }

  private pickTargetLevelGrade(
    pairs: { level: number; grade: number; weight: number }[]
  ): { level: number; grade: number } | null {
    if (pairs.length === 0) return null;
    const total = pairs.reduce((a, p) => a + p.weight, 0);
    let r = Math.random() * total;
    for (const p of pairs) {
      r -= p.weight;
      if (r <= 0) return { level: p.level, grade: p.grade };
    }
    const last = pairs[pairs.length - 1];
    return { level: last.level, grade: last.grade };
  }

  /** Returns sector by level and grade (1=white, 2=green, etc.). Public for spawn logic. */
  getSectorByLevelAndGrade(level: number, grade: number): Sector | null {
    const safeLevel = SectorService.normalizeSectorLevel(level);
    const safeGrade = Math.max(1, Math.min(5, grade));
    for (const s of this.sectors.values()) {
      if (s.level === safeLevel && (s.grade ?? SectorService.gradeFromId(s.id)) === safeGrade) {
        return s;
      }
    }
    return null;
  }

  private createBlackHole(sector: Sector): void {
    if (!Array.isArray(sector.world.blackHoles)) sector.world.blackHoles = [];
    if (sector.world.blackHoles.length >= MAX_BLACK_HOLES_PER_SECTOR) return;
    const pairs = this.getTargetLevelGradePairs(sector);
    const target = this.pickTargetLevelGrade(pairs);
    if (!target) return;
    const targetSector = this.getSectorByLevelAndGrade(target.level, target.grade);
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
    const targetName = this.getSectorDisplayName(targetSector);
    const targetGrade = targetSector.grade ?? SectorService.gradeFromId(targetSector.id);
    const targetGradeProbabilityPercent = this.getTargetProbabilityPercent(
      pairs,
      target.level,
      target.grade
    );
    const sectorLevel = Math.max(1, Math.min(5, targetSector.level));
    const targetRequiredPlayerLevel =
      MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL[sectorLevel] ?? 1;
    const hole: BlackHoleState = {
      id: `bh-${now}-${randInt(100, 999)}`,
      x,
      y,
      type: "warp",
      targetSectorId: targetSector.id,
      targetSectorName: targetName,
      targetLevel: sectorLevel,
      targetColor: targetSector.config?.color ?? "#ffffff",
      targetTitle: SectorService.getGradeTitle(targetGrade),
      targetGradeProbabilityPercent,
      targetRequiredPlayerLevel,
      appearsAt,
      expiresAt: appearsAt + durationMs,
    };
    sector.world.blackHoles.push(hole);
  }

  ensureBlackHole(sector: Sector): void {
    if (!Array.isArray(sector.world.blackHoles)) sector.world.blackHoles = [];
    const now = Date.now();
    sector.world.blackHoles = sector.world.blackHoles.filter((h) => h.expiresAt > now);
    const weight = sector.config?.blackHoleSpawnWeight ?? 0.5;
    if (weight <= 0) return;
    if (sector.world.blackHoles.length >= MAX_BLACK_HOLES_PER_SECTOR) return;
    if (Math.random() > weight) return;
    this.createBlackHole(sector);
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

  /** Returns a random sector of the given level (excluding excludeId). Only existing sectors — never creates new. */
  pickRandomSector(level: number, excludeId?: string): Sector | null {
    const safeLevel = SectorService.normalizeSectorLevel(level);
    const candidates = this.getSectorsByLevel(safeLevel).filter(
      (s) => !excludeId || s.id !== excludeId
    );
    if (candidates.length === 0) return null;
    return candidates[randInt(0, candidates.length - 1)];
  }

  /** Returns a display name that is never undefined or "undefined*". Always use for snapshot/response. */
  getSectorDisplayName(sector: Sector): string {
    const raw = sector.name != null ? String(sector.name).trim() : "";
    const valid =
      raw.length > 0 &&
      raw !== "undefined" &&
      raw !== "null" &&
      !/^\s*undefined(\s|$|-)/i.test(raw) &&
      !/^\s*null(\s|$|-)/i.test(raw);
    if (valid) return raw;
    const prefix = sector.config?.namePrefix ?? "Sector";
    return `${prefix} L${sector.level} • ?-${randInt(1, 99)}`;
  }

  /** Возвращает сектор уровня. Только из уже загруженных из БД — без генерации. */
  createSector(level: number): Sector {
    const safeLevel = SectorService.normalizeSectorLevel(level);
    const candidates = this.getSectorsByLevel(safeLevel);
    if (candidates.length === 0) {
      throw new Error(`No sector for level ${level} in DB. Run migrations to seed 25 sectors.`);
    }
    return candidates[randInt(0, candidates.length - 1)];
  }

  /** Выбор сектора по уровню и загрузке. Только секторы из БД, без генерации. */
  findOrCreateSector(level: number, excludeId?: string, presence?: PresenceService): Sector {
    const presenceService = presence ?? this.presence;
    const safeLevel = SectorService.normalizeSectorLevel(level);
    const candidates = this.getSectorsByLevel(safeLevel).filter((s) => s.id !== excludeId);
    let best: Sector | null = null;
    let bestCount = Infinity;
    for (const sector of candidates) {
      const count = presenceService.getSectorPlayerCount(sector.id);
      if (count < SECTOR_CAPACITY && count < bestCount) {
        best = sector;
        bestCount = count;
      }
    }
    if (best) return best;
    if (candidates.length > 0) return candidates[0];
    const anyOfLevel = this.getSectorsByLevel(safeLevel)[0];
    if (anyOfLevel) return anyOfLevel;
    throw new Error(`No sector for level ${safeLevel} in DB. Run migrations to seed 25 sectors.`);
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
    const sectorName = this.getSectorDisplayName(sector);
    const sectorGrade = sector.grade ?? SectorService.gradeFromId(sector.id);
    const sectorTitle = SectorService.getGradeTitle(sectorGrade);
    const sectorPercent = PVE_DEATH_PENALTY_PERCENT_BY_GRADE[sectorGrade] ?? PVE_DEATH_PENALTY_PERCENT_BY_GRADE[1];
    const pvpAllowed = sector.config?.pvpAllowed ?? false;
    const deathPenaltyPveMin = Math.min(100, DEATH_PENALTY_BASE_PERCENT_MIN + sectorPercent);
    const deathPenaltyPveMax = Math.min(100, DEATH_PENALTY_BASE_PERCENT_MAX + sectorPercent);
    const deathPenaltyPvpMin = pvpAllowed
      ? Math.min(100, Math.floor((DEATH_PENALTY_BASE_PERCENT_MIN + sectorPercent) * PVP_DEATH_PENALTY_EXTRA_MULT))
      : undefined;
    const deathPenaltyPvpMax = pvpAllowed
      ? Math.min(100, Math.floor((DEATH_PENALTY_BASE_PERCENT_MAX + sectorPercent) * PVP_DEATH_PENALTY_EXTRA_MULT))
      : undefined;
    return {
      seed: sector.world.seed,
      sector: {
        id: sector.id,
        name: sectorName,
        title: sectorTitle,
        level: Math.max(1, Math.min(5, sector.level)),
        grade: Math.max(1, Math.min(5, sectorGrade)),
        color: sector.config?.color ?? "#ffffff",
        width: sector.config.width,
        height: sector.config.height,
        pvpAllowed,
        deathPenaltyPveMin,
        deathPenaltyPveMax,
        ...(pvpAllowed && { deathPenaltyPvpMin, deathPenaltyPvpMax }),
      },
      blackHoles: (sector.world.blackHoles || [])
        .filter((h) => (h.appearsAt ?? 0) <= now && h.expiresAt > now)
        .map((h) => {
          let targetName =
            h.targetSectorName != null && String(h.targetSectorName).trim()
              ? String(h.targetSectorName).trim()
              : "";
          if (
            !targetName ||
            targetName === "undefined" ||
            targetName === "null" ||
            /^\s*undefined(\s|$|-)/i.test(targetName) ||
            /^\s*null(\s|$|-)/i.test(targetName)
          ) {
            const lvl = Math.max(1, Math.min(5, h.targetLevel ?? 1));
            const targetSector = this.sectors.get(h.targetSectorId);
            targetName = targetSector
              ? this.getSectorDisplayName(targetSector)
              : `Sector L${lvl}`;
          }
          const targetSector = this.sectors.get(h.targetSectorId);
          const targetTitle =
            h.targetTitle ??
            (targetSector
              ? SectorService.getGradeTitle(
                  targetSector.grade ?? SectorService.gradeFromId(targetSector.id)
                )
              : "");
          return {
            ...h,
            targetSectorName: targetName,
            targetLevel: Math.max(1, Math.min(5, h.targetLevel ?? 1)),
            targetTitle,
          };
        }),
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
