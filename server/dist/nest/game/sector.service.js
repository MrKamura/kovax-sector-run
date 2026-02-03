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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectorService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("../config/constants");
const presence_service_1 = require("./presence.service");
const utils_1 = require("./utils");
let SectorService = class SectorService {
    constructor(presence) {
        this.presence = presence;
        this.sectors = new Map();
        this.createSector(1);
        this.createSector(1);
        this.createSector(2);
        this.createSector(2);
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
        const { x, y } = this.randomPositionInSector(width, height, 160);
        const texture = enemyTextures?.length > 0
            ? enemyTextures[(0, utils_1.randInt)(0, enemyTextures.length - 1)]
            : "enemy_blue_1";
        const fixedLevel = constants_1.ENEMY_TYPE_LEVEL[texture];
        const level = fixedLevel ?? (0, utils_1.randInt)(enemyMinLevel, enemyMaxLevel);
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
    createBlackHole(sector) {
        if (!Array.isArray(sector.world.blackHoles))
            sector.world.blackHoles = [];
        if (sector.world.blackHoles.length >= constants_1.MAX_BLACK_HOLES_PER_SECTOR)
            return;
        const greenOrYellow = (0, utils_1.rand)() < 0.5 ? 1 : 2;
        const targetSector = this.pickRandomSector(greenOrYellow, sector.id);
        if (!targetSector || targetSector.id === sector.id)
            return;
        const { x, y } = this.randomPositionInSector(sector.config.width, sector.config.height, 140);
        const appearDelayMs = (0, utils_1.randBetween)(0, constants_1.BLACK_HOLE_APPEAR_DELAY_MS);
        const durationMs = constants_1.BLACK_HOLE_DURATION_MS * (0.5 + (0, utils_1.rand)());
        const now = Date.now();
        const appearsAt = now + appearDelayMs;
        const hole = {
            id: `bh-${now}-${(0, utils_1.randInt)(100, 999)}`,
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
    ensureBlackHole(sector) {
        if (!Array.isArray(sector.world.blackHoles))
            sector.world.blackHoles = [];
        const now = Date.now();
        sector.world.blackHoles = sector.world.blackHoles.filter((h) => h.expiresAt > now);
        if (sector.world.blackHoles.length < constants_1.MAX_BLACK_HOLES_PER_SECTOR) {
            this.createBlackHole(sector);
        }
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
    pickRandomSector(level, excludeId) {
        const candidates = this.getSectorsByLevel(level).filter((s) => !excludeId || s.id !== excludeId);
        if (candidates.length === 0)
            return this.createSector(level);
        return candidates[(0, utils_1.randInt)(0, candidates.length - 1)];
    }
    createSector(level) {
        const config = constants_1.SECTOR_CONFIGS[level];
        if (!config)
            throw new Error(`Unknown sector level: ${level}`);
        const sectorId = `L${level}-${Date.now()}-${(0, utils_1.randInt)(100, 999)}`;
        const sector = {
            id: sectorId,
            level,
            name: (0, utils_1.generateSectorName)(level),
            config: { ...config },
            world: this.createWorld(),
            createdAt: Date.now(),
        };
        this.ensureWorldPopulation(sector);
        this.sectors.set(sectorId, sector);
        return sector;
    }
    findOrCreateSector(level, excludeId, presence) {
        const presenceService = presence ?? this.presence;
        const candidates = this.getSectorsByLevel(level).filter((s) => s.id !== excludeId);
        let best = null;
        let bestCount = Infinity;
        for (const sector of candidates) {
            const count = presenceService.getSectorPlayerCount(sector.id);
            if (count < constants_1.SECTOR_CAPACITY && count < bestCount) {
                best = sector;
                bestCount = count;
            }
        }
        return best ?? this.createSector(level);
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
            blackHoles: (sector.world.blackHoles || []).filter((h) => (h.appearsAt ?? 0) <= now && h.expiresAt > now),
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
exports.SectorService = SectorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [presence_service_1.PresenceService])
], SectorService);
