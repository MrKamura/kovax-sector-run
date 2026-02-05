"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SectorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectorService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("../config/constants");
const presence_service_1 = require("./presence.service");
const db_service_1 = require("./db.service");
const utils_1 = require("./utils");
let SectorService = SectorService_1 = class SectorService {
    constructor(presence, db) {
        this.presence = presence;
        this.db = db;
        this.sectors = new Map();
    }
    /** Загружает все секторы из БД. Никакой генерации — только чтение. Список 25 секторов задаётся миграцией. */
    async loadSectorsFromDb(db) {
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
    static getGradeTitle(grade) {
        const titles = {
            1: "Белый",
            2: "Зелёный",
            3: "Жёлтый",
            4: "Фиолетовый",
            5: "Золотой",
        };
        return titles[Math.max(1, Math.min(5, grade))] ?? "Сектор";
    }
    /** Грейд из id: Lx-01 -> 1, Lx-02 -> 2, ... (1=белый, 5=золотой). */
    static gradeFromId(id) {
        const match = id.match(/-0?(\d)$/);
        const g = match ? parseInt(match[1], 10) : 1;
        return Math.max(1, Math.min(5, g));
    }
    instantiateSector(id, name, level) {
        const safeLevel = SectorService_1.normalizeSectorLevel(level);
        const grade = SectorService_1.gradeFromId(id);
        const configByGrade = constants_1.SECTOR_CONFIGS[grade];
        if (!configByGrade)
            return;
        const config = {
            ...configByGrade,
            enemyMinLevel: grade === 1 ? 1 : (grade - 1) * 5,
            enemyMaxLevel: grade * 5,
        };
        const sector = {
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
    createWorld() {
        return {
            seed: utils_1.worldSeed,
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
    getSectorCounts(sector) {
        const areaMult = (sector.config.width * sector.config.height) /
            (constants_1.WORLD_BASE_WIDTH * constants_1.WORLD_BASE_HEIGHT);
        return {
            pickups: Math.max(1, Math.round(constants_1.MAX_PICKUPS * areaMult)),
            enemies: Math.max(1, Math.round(constants_1.ENEMY_COUNT * areaMult)),
            asteroids: Math.max(1, Math.round(constants_1.ASTEROID_COUNT * areaMult)),
        };
    }
    /** Random position across full sector (use Math.random so distribution is uniform). */
    randomPositionInSector(width, height, margin) {
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
    spawnPickup(sector, resource, x, y, amount) {
        const id = sector.world.nextPickupId++;
        const pickup = {
            id,
            resource,
            x,
            y,
        };
        if (resource === "tokens" && amount != null && amount > 0)
            pickup.amount = amount;
        sector.world.pickups.set(id, pickup);
        return id;
    }
    spawnEnemy(sector) {
        const id = sector.world.nextEnemyId++;
        const { width, height, enemyMinLevel, enemyMaxLevel, enemyTextures } = sector.config;
        const minLvl = Math.max(1, enemyMinLevel ?? 1);
        const maxLvl = Math.min(100, enemyMaxLevel ?? 5);
        const { x, y } = this.randomPositionInSector(width, height, 160);
        const texture = enemyTextures?.length > 0
            ? enemyTextures[(0, utils_1.randInt)(0, enemyTextures.length - 1)]
            : "enemy_blue_1";
        const fixedLevel = constants_1.ENEMY_TYPE_LEVEL[texture];
        const rawLevel = fixedLevel ?? (0, utils_1.randInt)(minLvl, maxLvl);
        const level = Math.max(minLvl, Math.min(maxLvl, rawLevel));
        const stats = (0, utils_1.enemyStatsForLevel)(level);
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
            nextRoamAt: Date.now() + (0, utils_1.randBetween)(800, 2000),
            updatedAt: Date.now(),
        });
    }
    /** Public wrapper for respawn-after-kill (e.g. enemy_hit). */
    spawnEnemyPublic(sector) {
        this.spawnEnemy(sector);
    }
    spawnAsteroid(sector) {
        const id = sector.world.nextAsteroidId++;
        const { width, height, asteroidTextures } = sector.config;
        const { x, y } = this.randomPositionInSector(width, height, 120);
        const textureList = id % 3 === 0 ? asteroidTextures?.small : asteroidTextures?.big;
        const texture = textureList?.length > 0
            ? textureList[(0, utils_1.randInt)(0, textureList.length - 1)]
            : "meteor_big";
        const scale = (0, utils_1.randBetween)(0.7, 1.2);
        sector.world.asteroids.set(id, { id, x, y, texture, scale });
    }
    ensureWorldPopulation(sector) {
        const { pickups, enemies, asteroids } = this.getSectorCounts(sector);
        const scrapCount = Array.from(sector.world.pickups.values()).filter((p) => p.resource === "scrap").length;
        const neededScrap = Math.max(0, pickups - scrapCount);
        for (let i = 0; i < neededScrap; i++) {
            const { x, y } = this.randomPositionInSector(sector.config.width, sector.config.height, 100);
            this.spawnPickup(sector, "scrap", x, y);
        }
        const neededEnemies = Math.max(0, enemies - sector.world.enemies.size);
        for (let i = 0; i < neededEnemies; i++)
            this.spawnEnemy(sector);
        const neededAsteroids = Math.max(0, asteroids - sector.world.asteroids.size);
        for (let i = 0; i < neededAsteroids; i++)
            this.spawnAsteroid(sector);
    }
    static normalizeSectorLevel(level) {
        const n = Number(level);
        if (!Number.isFinite(n))
            return 1;
        return Math.max(1, Math.min(5, Math.floor(n)));
    }
    /** Цели портала: тот же уровень (другие грейды) + соседние уровни (все грейды). Соседние уровни взвешены по грейду из BLACK_HOLE_GRADE_WEIGHTS. */
    getTargetLevelGradePairs(current) {
        const L = SectorService_1.normalizeSectorLevel(current.level);
        const G = Math.max(1, Math.min(5, current.grade ?? SectorService_1.gradeFromId(current.id)));
        const out = [];
        const sameWeight = constants_1.BLACK_HOLE_SAME_LEVEL_WEIGHT;
        const gradeWeight = (g) => constants_1.BLACK_HOLE_GRADE_WEIGHTS[g] ?? 1 / Math.max(1, g);
        for (let g = 1; g <= 5; g++) {
            if (g !== G)
                out.push({ level: L, grade: g, weight: sameWeight });
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
    getTargetProbabilityPercent(pairs, targetLevel, targetGrade) {
        const total = pairs.reduce((a, p) => a + p.weight, 0);
        if (total <= 0)
            return 0;
        const p = pairs.find((x) => x.level === targetLevel && x.grade === targetGrade);
        if (!p)
            return 0;
        return Math.round((p.weight / total) * 100);
    }
    pickTargetLevelGrade(pairs) {
        if (pairs.length === 0)
            return null;
        const total = pairs.reduce((a, p) => a + p.weight, 0);
        let r = Math.random() * total;
        for (const p of pairs) {
            r -= p.weight;
            if (r <= 0)
                return { level: p.level, grade: p.grade };
        }
        const last = pairs[pairs.length - 1];
        return { level: last.level, grade: last.grade };
    }
    getSectorByLevelAndGrade(level, grade) {
        const safeLevel = SectorService_1.normalizeSectorLevel(level);
        const safeGrade = Math.max(1, Math.min(5, grade));
        for (const s of this.sectors.values()) {
            if (s.level === safeLevel && (s.grade ?? SectorService_1.gradeFromId(s.id)) === safeGrade) {
                return s;
            }
        }
        return null;
    }
    createBlackHole(sector) {
        if (!Array.isArray(sector.world.blackHoles))
            sector.world.blackHoles = [];
        if (sector.world.blackHoles.length >= constants_1.MAX_BLACK_HOLES_PER_SECTOR)
            return;
        const pairs = this.getTargetLevelGradePairs(sector);
        const target = this.pickTargetLevelGrade(pairs);
        if (!target)
            return;
        const targetSector = this.getSectorByLevelAndGrade(target.level, target.grade);
        if (!targetSector || targetSector.id === sector.id)
            return;
        const { x, y } = this.randomPositionInSector(sector.config.width, sector.config.height, 140);
        const appearDelayMs = (0, utils_1.randBetween)(0, constants_1.BLACK_HOLE_APPEAR_DELAY_MS);
        const durationMs = constants_1.BLACK_HOLE_DURATION_MS * (0.5 + (0, utils_1.rand)());
        const now = Date.now();
        const appearsAt = now + appearDelayMs;
        const targetName = this.getSectorDisplayName(targetSector);
        const targetGrade = targetSector.grade ?? SectorService_1.gradeFromId(targetSector.id);
        const targetGradeProbabilityPercent = this.getTargetProbabilityPercent(pairs, target.level, target.grade);
        const sectorLevel = Math.max(1, Math.min(5, targetSector.level));
        const targetRequiredPlayerLevel = constants_1.MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL[sectorLevel] ?? 1;
        const hole = {
            id: `bh-${now}-${(0, utils_1.randInt)(100, 999)}`,
            x,
            y,
            type: "warp",
            targetSectorId: targetSector.id,
            targetSectorName: targetName,
            targetLevel: sectorLevel,
            targetColor: targetSector.config?.color ?? "#ffffff",
            targetTitle: SectorService_1.getGradeTitle(targetGrade),
            targetGradeProbabilityPercent,
            targetRequiredPlayerLevel,
            appearsAt,
            expiresAt: appearsAt + durationMs,
        };
        sector.world.blackHoles.push(hole);
    }
    ensureBlackHole(sector) {
        if (!Array.isArray(sector.world.blackHoles))
            sector.world.blackHoles = [];
        const now = Date.now();
        sector.world.blackHoles = sector.world.blackHoles.filter((h) => h.expiresAt > now);
        const weight = sector.config?.blackHoleSpawnWeight ?? 0.5;
        if (weight <= 0)
            return;
        if (sector.world.blackHoles.length >= constants_1.MAX_BLACK_HOLES_PER_SECTOR)
            return;
        if (Math.random() > weight)
            return;
        this.createBlackHole(sector);
    }
    ensureSafeZone(sector) {
        const now = Date.now();
        const zone = sector.world.safeZone;
        const lastMove = sector.world.lastSafeZoneMoveAt || 0;
        if (!zone) {
            sector.world.lastSafeZoneMoveAt = now;
            const { x: szX, y: szY } = this.randomPositionInSector(sector.config.width, sector.config.height, 200);
            sector.world.safeZone = {
                id: `sz-${Date.now()}-${(0, utils_1.randInt)(100, 999)}`,
                x: szX,
                y: szY,
                radius: constants_1.SAFE_ZONE_RADIUS,
                expiresAt: now + constants_1.SAFE_ZONE_DURATION_MS,
                color: sector.config.color,
            };
            return true;
        }
        if (zone.expiresAt <= now) {
            if (now - lastMove >= constants_1.SAFE_ZONE_COOLDOWN_MS) {
                sector.world.lastSafeZoneMoveAt = now;
                const { x: szX, y: szY } = this.randomPositionInSector(sector.config.width, sector.config.height, 200);
                sector.world.safeZone = {
                    id: `sz-${Date.now()}-${(0, utils_1.randInt)(100, 999)}`,
                    x: szX,
                    y: szY,
                    radius: constants_1.SAFE_ZONE_RADIUS,
                    expiresAt: now + constants_1.SAFE_ZONE_DURATION_MS,
                    color: sector.config.color,
                };
                return true;
            }
            zone.expiresAt = now + constants_1.SAFE_ZONE_DURATION_MS;
        }
        return false;
    }
    getSectorsByLevel(level) {
        return Array.from(this.sectors.values()).filter((s) => s.level === level);
    }
    /** Returns a random sector of the given level (excluding excludeId). Only existing sectors — never creates new. */
    pickRandomSector(level, excludeId) {
        const safeLevel = SectorService_1.normalizeSectorLevel(level);
        const candidates = this.getSectorsByLevel(safeLevel).filter((s) => !excludeId || s.id !== excludeId);
        if (candidates.length === 0)
            return null;
        return candidates[(0, utils_1.randInt)(0, candidates.length - 1)];
    }
    /** Returns a display name that is never undefined or "undefined*". Always use for snapshot/response. */
    getSectorDisplayName(sector) {
        const raw = sector.name != null ? String(sector.name).trim() : "";
        const valid = raw.length > 0 &&
            raw !== "undefined" &&
            raw !== "null" &&
            !/^\s*undefined(\s|$|-)/i.test(raw) &&
            !/^\s*null(\s|$|-)/i.test(raw);
        if (valid)
            return raw;
        const prefix = sector.config?.namePrefix ?? "Sector";
        return `${prefix} L${sector.level} • ?-${(0, utils_1.randInt)(1, 99)}`;
    }
    /** Возвращает сектор уровня. Только из уже загруженных из БД — без генерации. */
    createSector(level) {
        const safeLevel = SectorService_1.normalizeSectorLevel(level);
        const candidates = this.getSectorsByLevel(safeLevel);
        if (candidates.length === 0) {
            throw new Error(`No sector for level ${level} in DB. Run migrations to seed 25 sectors.`);
        }
        return candidates[(0, utils_1.randInt)(0, candidates.length - 1)];
    }
    /** Выбор сектора по уровню и загрузке. Только секторы из БД, без генерации. */
    findOrCreateSector(level, excludeId, presence) {
        const presenceService = presence ?? this.presence;
        const safeLevel = SectorService_1.normalizeSectorLevel(level);
        const candidates = this.getSectorsByLevel(safeLevel).filter((s) => s.id !== excludeId);
        let best = null;
        let bestCount = Infinity;
        for (const sector of candidates) {
            const count = presenceService.getSectorPlayerCount(sector.id);
            if (count < constants_1.SECTOR_CAPACITY && count < bestCount) {
                best = sector;
                bestCount = count;
            }
        }
        if (best)
            return best;
        if (candidates.length > 0)
            return candidates[0];
        const anyOfLevel = this.getSectorsByLevel(safeLevel)[0];
        if (anyOfLevel)
            return anyOfLevel;
        throw new Error(`No sector for level ${safeLevel} in DB. Run migrations to seed 25 sectors.`);
    }
    isInsideSafeZone(zone, x, y) {
        if (!zone)
            return false;
        return Math.hypot(x - zone.x, y - zone.y) <= zone.radius;
    }
    isInsideGravityPit(pit, x, y) {
        if (!pit || pit.expiresAt <= Date.now())
            return false;
        return Math.hypot(x - pit.x, y - pit.y) <= pit.radius;
    }
    isInsideAnyGravityPit(pits, x, y) {
        const now = Date.now();
        for (const pit of pits) {
            if (pit.expiresAt <= now)
                continue;
            if (Math.hypot(x - pit.x, y - pit.y) <= pit.radius)
                return true;
        }
        return false;
    }
    getWorldSnapshot(sector) {
        const now = Date.now();
        const safeZone = sector.world.safeZone
            ? {
                ...sector.world.safeZone,
                movesAt: sector.world.lastSafeZoneMoveAt + constants_1.SAFE_ZONE_COOLDOWN_MS,
            }
            : null;
        const sectorName = this.getSectorDisplayName(sector);
        const sectorGrade = sector.grade ?? SectorService_1.gradeFromId(sector.id);
        const sectorTitle = SectorService_1.getGradeTitle(sectorGrade);
        const sectorPercent = constants_1.PVE_DEATH_PENALTY_PERCENT_BY_GRADE[sectorGrade] ?? constants_1.PVE_DEATH_PENALTY_PERCENT_BY_GRADE[1];
        const pvpAllowed = sector.config?.pvpAllowed ?? false;
        const deathPenaltyPveMin = Math.min(100, constants_1.DEATH_PENALTY_BASE_PERCENT_MIN + sectorPercent);
        const deathPenaltyPveMax = Math.min(100, constants_1.DEATH_PENALTY_BASE_PERCENT_MAX + sectorPercent);
        const deathPenaltyPvpMin = pvpAllowed
            ? Math.min(100, Math.floor((constants_1.DEATH_PENALTY_BASE_PERCENT_MIN + sectorPercent) * constants_1.PVP_DEATH_PENALTY_EXTRA_MULT))
            : undefined;
        const deathPenaltyPvpMax = pvpAllowed
            ? Math.min(100, Math.floor((constants_1.DEATH_PENALTY_BASE_PERCENT_MAX + sectorPercent) * constants_1.PVP_DEATH_PENALTY_EXTRA_MULT))
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
                let targetName = h.targetSectorName != null && String(h.targetSectorName).trim()
                    ? String(h.targetSectorName).trim()
                    : "";
                if (!targetName ||
                    targetName === "undefined" ||
                    targetName === "null" ||
                    /^\s*undefined(\s|$|-)/i.test(targetName) ||
                    /^\s*null(\s|$|-)/i.test(targetName)) {
                    const lvl = Math.max(1, Math.min(5, h.targetLevel ?? 1));
                    const targetSector = this.sectors.get(h.targetSectorId);
                    targetName = targetSector
                        ? this.getSectorDisplayName(targetSector)
                        : `Sector L${lvl}`;
                }
                const targetSector = this.sectors.get(h.targetSectorId);
                const targetTitle = h.targetTitle ??
                    (targetSector
                        ? SectorService_1.getGradeTitle(targetSector.grade ?? SectorService_1.gradeFromId(targetSector.id))
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
                const fallbackTexture = sector.config.asteroidTextures?.big?.[0] ?? "meteor_big";
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
    ensureSafeZoneForSector(sector) {
        return this.ensureSafeZone(sector);
    }
    ensureWorldPopulationForSector(sector) {
        this.ensureWorldPopulation(sector);
    }
    spawnPickupPublic(sector, resource, x, y, amount) {
        return this.spawnPickup(sector, resource, x, y, amount);
    }
};
exports.SectorService = SectorService;
exports.SectorService = SectorService = SectorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [presence_service_1.PresenceService,
        db_service_1.DbService])
], SectorService);
