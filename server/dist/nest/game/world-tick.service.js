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
exports.WorldTickService = void 0;
exports.createWorldTickState = createWorldTickState;
exports.runWorldTick = runWorldTick;
const common_1 = require("@nestjs/common");
const constants_1 = require("../config/constants");
const utils_1 = require("./utils");
const sector_service_1 = require("./sector.service");
const presence_service_1 = require("./presence.service");
const broadcast_service_1 = require("./broadcast.service");
const player_service_1 = require("./player.service");
const utils_2 = require("./utils");
const db_service_1 = require("./db.service");
function createWorldTickState() {
    return {
        lastWorldTick: Date.now(),
        lastVengeanceHuntedPushByUser: new Map(),
    };
}
function sendSelfUpdateToPresence(presence, userId, payload) {
    const sockets = presence.getSockets(userId);
    if (!sockets)
        return;
    const message = JSON.stringify({ type: "self", ...payload });
    for (const socket of sockets) {
        if (socket.readyState === 1)
            socket.send(message);
    }
}
async function persistHealthForTick(db, userId, next, shipChoice) {
    try {
        const player = await db.Player.findOne({
            where: { userId },
            attributes: ["monsterProgress"],
        });
        const progress = player?.monsterProgress || {};
        const key = (0, utils_2.normalizeMonsterChoice)(shipChoice);
        const stored = (0, utils_2.getMonsterProgressEntry)(progress, key) || {};
        const nextProgress = {
            ...progress,
            [key]: { ...stored, health: next },
        };
        await db.Player.update({
            health: next,
            lastHealthAt: new Date(),
            monsterProgress: nextProgress,
        }, { where: { userId } });
    }
    catch {
        // ignore
    }
}
function runWorldTick(services, state) {
    const { sectorService, presence, broadcast, db } = services;
    try {
        if (!sectorService?.sectors)
            return;
        const now = Date.now();
        const dt = Math.min((now - state.lastWorldTick) / 1000, 0.2);
        state.lastWorldTick = now;
        for (const sector of sectorService.sectors.values()) {
            sectorService.ensureWorldPopulationForSector(sector);
            sectorService.ensureBlackHole(sector);
            sectorService.ensureSafeZoneForSector(sector);
            if (Array.isArray(sector.world.gravityPits)) {
                sector.world.gravityPits = sector.world.gravityPits.filter((p) => p.expiresAt > now);
            }
            for (const enemy of sector.world.enemies.values()) {
                let target = null;
                let nearestDist = Infinity;
                for (const entry of presence.presence.values()) {
                    if (entry.isDead || entry.sectorId !== sector.id)
                        continue;
                    if (entry.invulnerableUntil && entry.invulnerableUntil > now)
                        continue;
                    if (sectorService.isInsideSafeZone(sector.world.safeZone, entry.x, entry.y))
                        continue;
                    const dx = entry.x - enemy.x;
                    const dy = entry.y - enemy.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < nearestDist && dist <= constants_1.ENEMY_VISION_RANGE) {
                        nearestDist = dist;
                        target = { dx, dy, dist };
                    }
                }
                const inGravityPit = sectorService.isInsideAnyGravityPit(sector.world.gravityPits, enemy.x, enemy.y);
                const enemySpeedMult = inGravityPit ? constants_1.GRAVITY_PIT_SLOW : 1;
                if (target) {
                    const nx = target.dx / (target.dist || 1);
                    const ny = target.dy / (target.dist || 1);
                    enemy.x += nx * constants_1.ENEMY_SPEED * enemySpeedMult * dt;
                    enemy.y += ny * constants_1.ENEMY_SPEED * enemySpeedMult * dt;
                    enemy.rotation = Math.atan2(ny, nx) + Math.PI / 2;
                }
                else {
                    const nowMs = Date.now();
                    const dx = enemy.roamTargetX - enemy.x;
                    const dy = enemy.roamTargetY - enemy.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < 100 || nowMs >= enemy.nextRoamAt) {
                        const angle = (0, utils_1.randBetween)(0, Math.PI * 2);
                        const dist = (0, utils_1.randBetween)(constants_1.ENEMY_ROAM_RADIUS * 0.2, constants_1.ENEMY_ROAM_RADIUS);
                        enemy.roamTargetX = Math.min(sector.config.width - 80, Math.max(80, enemy.spawnX + Math.cos(angle) * dist));
                        enemy.roamTargetY = Math.min(sector.config.height - 80, Math.max(80, enemy.spawnY + Math.sin(angle) * dist));
                        enemy.nextRoamAt = nowMs + 1800;
                    }
                    else {
                        const dist = Math.sqrt(distSq) || 1;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        enemy.x += nx * constants_1.ENEMY_SPEED * 0.5 * enemySpeedMult * dt;
                        enemy.y += ny * constants_1.ENEMY_SPEED * 0.5 * enemySpeedMult * dt;
                        enemy.rotation = Math.atan2(ny, nx) + Math.PI / 2;
                    }
                }
                enemy.x = Math.min(sector.config.width - 80, Math.max(80, enemy.x));
                enemy.y = Math.min(sector.config.height - 80, Math.max(80, enemy.y));
                enemy.updatedAt = now;
            }
            const zone = sector.world.safeZone;
            if (zone && zone.expiresAt > now) {
                for (const entry of presence.presence.values()) {
                    if (entry.isDead || entry.sectorId !== sector.id)
                        continue;
                    const wasInSafeZone = entry.wasInSafeZone ?? false;
                    const isInSafeZone = sectorService.isInsideSafeZone(zone, entry.x, entry.y);
                    if (wasInSafeZone && !isInSafeZone) {
                        entry.invulnerableUntil = now + constants_1.SAFE_ZONE_EXIT_IMMUNITY_MS;
                        entry.updatedAt = now;
                        presence.setEntry(entry.userId, entry);
                        sendSelfUpdateToPresence(presence, entry.userId, {
                            invulnerableUntil: entry.invulnerableUntil,
                        });
                    }
                    entry.wasInSafeZone = isInSafeZone;
                    if (!isInSafeZone)
                        continue;
                    const last = Number(entry.lastSafeZoneRegenAt ?? 0) || 0;
                    if (now - last < 1000)
                        continue;
                    entry.lastSafeZoneRegenAt = now;
                    if (Number(entry.health ?? 0) <= 0)
                        continue;
                    const maxHealth = Number(entry.maxHealth ?? 0) || 0;
                    if (maxHealth <= 0)
                        continue;
                    const current = Number(entry.health) || 0;
                    if (current >= maxHealth)
                        continue;
                    const heal = 4;
                    const next = Math.min(maxHealth, current + heal);
                    entry.health = next;
                    entry.updatedAt = now;
                    presence.setEntry(entry.userId, entry);
                    void persistHealthForTick(db, entry.userId, next, entry.shipChoice);
                }
            }
            else {
                for (const entry of presence.presence.values()) {
                    if (entry.sectorId === sector.id)
                        entry.wasInSafeZone = false;
                }
            }
            // Healing skill: strong health regen while effect is active
            const HEALING_REGEN_PER_SEC = 25;
            for (const entry of presence.presence.values()) {
                if (entry.isDead || entry.sectorId !== sector.id)
                    continue;
                if (!entry.healingExpiresAt || entry.healingExpiresAt <= now)
                    continue;
                const last = Number(entry.lastHealingRegenAt ?? 0) || 0;
                if (now - last < 1000)
                    continue;
                entry.lastHealingRegenAt = now;
                const maxHealth = Number(entry.maxHealth ?? 0) || 0;
                if (maxHealth <= 0)
                    continue;
                const current = Number(entry.health) || 0;
                if (current >= maxHealth)
                    continue;
                const heal = Math.min(HEALING_REGEN_PER_SEC, maxHealth - current);
                const next = current + heal;
                entry.health = next;
                entry.updatedAt = now;
                presence.setEntry(entry.userId, entry);
                broadcast.sendPlayerUpdate(entry.userId, { health: next });
                void persistHealthForTick(db, entry.userId, next, entry.shipChoice);
            }
            for (const entry of presence.presence.values()) {
                if (entry.isDead || entry.sectorId !== sector.id)
                    continue;
                const pits = sector.world.gravityPits || [];
                let insidePitNotOwned = false;
                for (const pit of pits) {
                    if (pit.expiresAt <= now)
                        continue;
                    if (pit.ownerUserId === entry.userId)
                        continue;
                    if (sectorService.isInsideGravityPit(pit, entry.x, entry.y)) {
                        insidePitNotOwned = true;
                        break;
                    }
                }
                entry.movementSpeedMultiplier = insidePitNotOwned ? constants_1.GRAVITY_PIT_SLOW : 1;
            }
            // Inline world broadcast using passed sectorService/presence (BroadcastService may have undefined injected deps)
            const worldPayload = JSON.stringify({
                type: "world",
                serverTime: Date.now(),
                world: sectorService.getWorldSnapshot(sector),
            });
            for (const sockets of presence.clients.values()) {
                for (const socket of sockets) {
                    if (socket.readyState === 1 && socket.sectorId === sector.id)
                        socket.send(worldPayload);
                }
            }
        }
        for (const entry of presence.presence.values()) {
            const lastPush = state.lastVengeanceHuntedPushByUser.get(entry.userId) ?? 0;
            const shouldPush = now - lastPush >= constants_1.VENGEANCE_HUNTED_PUSH_INTERVAL_MS;
            if (entry.vengeanceExpiresAt && entry.vengeanceTargetUserId) {
                if (entry.vengeanceExpiresAt <= now) {
                    entry.vengeanceTargetUserId = undefined;
                    entry.vengeanceExpiresAt = undefined;
                    entry.updatedAt = now;
                    presence.setEntry(entry.userId, entry);
                    sendSelfUpdateToPresence(presence, entry.userId, { vengeance: null });
                    state.lastVengeanceHuntedPushByUser.delete(entry.userId);
                }
                else if (shouldPush) {
                    const targetEntry = presence.getEntry(entry.vengeanceTargetUserId);
                    const targetSector = targetEntry?.sectorId
                        ? sectorService.sectors.get(targetEntry.sectorId)
                        : null;
                    sendSelfUpdateToPresence(presence, entry.userId, {
                        vengeance: {
                            targetUserId: entry.vengeanceTargetUserId,
                            targetNickname: targetEntry?.nickname ?? `Пилот ${entry.vengeanceTargetUserId}`,
                            expiresAt: entry.vengeanceExpiresAt,
                            targetSectorId: targetEntry?.sectorId ?? null,
                            targetSectorName: targetSector?.name ?? null,
                        },
                    });
                    state.lastVengeanceHuntedPushByUser.set(entry.userId, now);
                }
            }
            else if (entry.huntedExpiresAt && entry.huntedByUserId) {
                if (entry.huntedExpiresAt <= now) {
                    entry.huntedByUserId = undefined;
                    entry.huntedExpiresAt = undefined;
                    entry.updatedAt = now;
                    presence.setEntry(entry.userId, entry);
                    sendSelfUpdateToPresence(presence, entry.userId, { hunted: null });
                    state.lastVengeanceHuntedPushByUser.delete(entry.userId);
                }
                else if (shouldPush) {
                    const hunterEntry = presence.getEntry(entry.huntedByUserId);
                    sendSelfUpdateToPresence(presence, entry.userId, {
                        hunted: {
                            hunterUserId: entry.huntedByUserId,
                            hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
                            expiresAt: entry.huntedExpiresAt,
                        },
                    });
                    state.lastVengeanceHuntedPushByUser.set(entry.userId, now);
                }
            }
        }
    }
    catch (err) {
        console.error("World tick error:", err);
    }
}
let WorldTickService = class WorldTickService {
    constructor(sectorService, presence, broadcast, player, db) {
        this.sectorService = sectorService;
        this.presence = presence;
        this.broadcast = broadcast;
        this.player = player;
        this.db = db;
        this.state = createWorldTickState();
        this.tick = this.tick.bind(this);
    }
    tick() {
        if (!this.sectorService?.sectors)
            return;
        runWorldTick({
            sectorService: this.sectorService,
            presence: this.presence,
            broadcast: this.broadcast,
            player: this.player,
            db: this.db,
        }, this.state);
    }
};
exports.WorldTickService = WorldTickService;
exports.WorldTickService = WorldTickService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sector_service_1.SectorService,
        presence_service_1.PresenceService,
        broadcast_service_1.BroadcastService,
        player_service_1.PlayerService,
        db_service_1.DbService])
], WorldTickService);
