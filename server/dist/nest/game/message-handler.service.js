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
exports.MessageHandlerService = void 0;
const common_1 = require("@nestjs/common");
const presence_service_1 = require("./presence.service");
const sector_service_1 = require("./sector.service");
const broadcast_service_1 = require("./broadcast.service");
const chat_service_1 = require("./chat.service");
const player_service_1 = require("./player.service");
const quest_service_1 = require("./quest.service");
const db_service_1 = require("./db.service");
const constants_1 = require("../config/constants");
const utils_1 = require("./utils");
const constants_2 = require("../config/constants");
function startSpawnImmunityIfNeeded(entry, userId, services) {
    if (!entry || entry.invulnerableUntil < constants_1.SPAWN_IMMUNITY_UNTIL_FIRST_ACTION)
        return;
    const now = Date.now();
    entry.invulnerableUntil = now + constants_1.SPAWN_IMMUNITY_AFTER_ACTION_MS;
    services.presence.setEntry(userId, entry);
    services.broadcast.sendSelfUpdate(userId, { serverTime: now, invulnerableUntil: entry.invulnerableUntil }, services.presence);
}
/**
 * Handles all WebSocket message types from the game client.
 * Each branch corresponds to message.type.
 * When gateway passes resolved services (createApplicationContext), use them; else use injected.
 */
let MessageHandlerService = class MessageHandlerService {
    constructor(presence, sectorService, broadcast, chat, player, quest, db) {
        this.presence = presence;
        this.sectorService = sectorService;
        this.broadcast = broadcast;
        this.chat = chat;
        this.player = player;
        this.quest = quest;
        this.db = db;
    }
    async handle(user, message, socket, resolved) {
        const services = {
            presence: resolved?.presence ?? this.presence,
            sectorService: resolved?.sectorService ?? this.sectorService,
            broadcast: resolved?.broadcast ?? this.broadcast,
            chat: resolved?.chat ?? this.chat,
            player: resolved?.player ?? this.player,
            quest: resolved?.quest ?? this.quest,
            db: resolved?.db ?? this.db,
        };
        if (message.type === "update") {
            await this.handleUpdate(user, message, services);
            return;
        }
        if (message.type === "player_dead") {
            await this.handlePlayerDead(user, services);
            return;
        }
        if (message.type === "respawn" || message.type === "respawn_vengeance") {
            await this.handleRespawn(user, message, socket, services);
            return;
        }
        if (message.type === "use_black_hole") {
            await this.handleUseBlackHole(user, message, services);
            return;
        }
        if (message.type === "pickup_collect") {
            await this.handlePickupCollect(user, message, services);
            return;
        }
        if (message.type === "skill_immunity") {
            this.handleSkillImmunity(user, message, services);
            return;
        }
        if (message.type === "skill_healing") {
            this.handleSkillHealing(user, message, services);
            return;
        }
        if (message.type === "skill_fury") {
            this.handleSkillFury(user, message, services);
            return;
        }
        if (message.type === "skill_gravity_pit") {
            this.handleSkillGravityPit(user, message, services);
            return;
        }
        if (message.type === "skill_teleport") {
            this.handleSkillTeleport(user, message, socket, services);
            return;
        }
        if (message.type === "enemy_hit") {
            await this.handleEnemyHit(user, message, services);
            return;
        }
        if (message.type === "player_hit") {
            await this.handlePlayerHit(user, message, services);
            return;
        }
        if (message.type === "start_quest") {
            await this.handleStartQuest(user, message, services);
            return;
        }
        if (message.type === "cancel_quest") {
            await this.handleCancelQuest(user, message, services);
            return;
        }
        if (message.type === "asteroid_destroy") {
            this.handleAsteroidDestroy(user, message, services);
            return;
        }
        if (message.type === "chat_message") {
            await this.handleChatMessage(user, message, services);
            return;
        }
        if (message.type === "chat_history_request") {
            await this.handleChatHistoryRequest(user, message, socket, services);
            return;
        }
        if (message.type === "request_exit") {
            this.handleRequestExit(user, socket, services);
            return;
        }
        if (message.type === "disconnect") {
            socket.close(1000);
            return;
        }
    }
    async handleUpdate(user, message, services) {
        const next = services.presence.getEntry(user.id);
        if (!next)
            return;
        startSpawnImmunityIfNeeded(next, user.id, services);
        const newX = Number(message.x) ?? next.x;
        const newY = Number(message.y) ?? next.y;
        const moved = newX !== next.x || newY !== next.y;
        if (moved)
            startSpawnImmunityIfNeeded(next, user.id, services);
        next.x = newX;
        next.y = newY;
        next.rotation = Number(message.rotation) ?? next.rotation;
        if (message.shipChoice === "keeper19" || message.shipChoice === "keeper20") {
            next.shipChoice = message.shipChoice;
        }
        const level = Number(message.level);
        const health = Number(message.health);
        const maxHealth = Number(message.maxHealth);
        const firingAt = message.firingAt == null ? null : Number(message.firingAt ?? 0);
        if (Number.isFinite(health) && health >= 0)
            next.health = health;
        if (Number.isFinite(maxHealth) && maxHealth > 0)
            next.maxHealth = maxHealth;
        if (Number.isFinite(level) && level > 0)
            next.level = level;
        next.firingAt = Number.isFinite(firingAt) ? firingAt : null;
        next.updatedAt = Date.now();
        services.presence.setEntry(user.id, next);
        if (next.sectorId)
            services.broadcast.broadcastPresence(next.sectorId, services.presence);
        const now = Date.now();
        if (now - next.lastSavedAt > 2000) {
            next.lastSavedAt = now;
            void services.player.savePlayerPosition(next, services.db);
        }
    }
    async handlePlayerDead(user, services) {
        const entry = services.presence.getEntry(user.id);
        if (!entry || entry.isDead)
            return;
        entry.isDead = true;
        entry.updatedAt = Date.now();
        services.presence.setEntry(user.id, entry);
        if (entry.sectorId)
            services.broadcast.broadcastPresence(entry.sectorId, services.presence);
        const sector = entry.sectorId ? services.sectorService.sectors.get(entry.sectorId) : null;
        const grade = sector?.grade ?? 1;
        const basePercent = (0, utils_1.randInt)(constants_2.DEATH_PENALTY_BASE_PERCENT_MIN, constants_2.DEATH_PENALTY_BASE_PERCENT_MAX);
        const sectorPercent = constants_2.PVE_DEATH_PENALTY_PERCENT_BY_GRADE[grade] ?? constants_2.PVE_DEATH_PENALTY_PERCENT_BY_GRADE[1];
        const penaltyPercent = Math.min(100, basePercent + sectorPercent);
        try {
            const playerRow = await services.db.Player.findOne({
                where: { userId: user.id },
                attributes: ["exp", "expToNext", "resources", "monsterProgress"],
            });
            if (!playerRow)
                return;
            const resources = playerRow.resources || { scrap: 0, tokens: 0 };
            const tokens = Number(resources.tokens ?? 0) || 0;
            const progress = playerRow.monsterProgress || {};
            const monsterKey = (0, utils_1.normalizeMonsterChoice)(entry.shipChoice);
            const stored = (0, utils_1.getMonsterProgressEntry)(progress, monsterKey) || {};
            let exp = Number(stored.exp ?? playerRow.exp ?? 0) || 0;
            const level = Number(stored.level ?? 1) || 1;
            const expToNext = Number(stored.expToNext) ?? (0, utils_1.expToNextLevel)(level);
            const percent = Math.max(0, Math.min(100, penaltyPercent)) / 100;
            let lostExp = Math.floor(exp * percent);
            let lostTokens = Math.floor(tokens * percent);
            if (exp > 0 && lostExp === 0)
                lostExp = 1;
            if (tokens > 0 && lostTokens === 0)
                lostTokens = 1;
            const newExp = Math.max(0, exp - lostExp);
            const newTokens = Math.max(0, tokens - lostTokens);
            const nextResources = {
                scrap: Number(resources.scrap ?? 0) || 0,
                tokens: newTokens,
            };
            const nextProgress = {
                ...progress,
                [monsterKey]: { ...stored, exp: newExp },
            };
            await services.db.Player.update({
                resources: nextResources,
                monsterProgress: nextProgress,
            }, { where: { userId: user.id } });
            entry.level = level;
            services.presence.setEntry(user.id, entry);
            services.broadcast.sendPlayerUpdate(user.id, {
                level,
                exp: newExp,
                expToNext: (0, utils_1.expToNextLevel)(level),
                resources: nextResources,
            }, services.presence);
            services.broadcast.sendDeathUpdate(user.id, {
                lostExp,
                lostTokens,
                expPercent: penaltyPercent,
                tokenPercent: penaltyPercent,
                killedBy: "Мобы",
                killedByUserId: 0,
            }, services.presence);
            // Проваливаем PvP квест, если игрок умер от мобов (в PvP квесте нельзя умирать)
            if (entry.sectorId) {
                try {
                    await services.quest.failPvpQuest(user.id, entry.sectorId);
                    // Убираем флаг hasPvpQuest при провале квеста
                    if (entry.hasPvpQuest) {
                        entry.hasPvpQuest = false;
                        services.presence.setEntry(user.id, entry);
                        services.broadcast.broadcastPresence(entry.sectorId, services.presence);
                    }
                    // Отправляем сообщение о провале квеста
                    const sector = services.sectorService.sectors.get(entry.sectorId);
                    const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : "секторе";
                    const chatEntry = {
                        id: `quest-pvp-failed-mob-${Date.now()}-${user.id}`,
                        userId: user.id,
                        nickname: "Система",
                        text: `${entry.nickname ?? `Пилот ${user.id}`}, PvP квест провален в ${sectorName} (смерть от мобов). Попробуйте еще раз!`,
                        createdAt: Date.now(),
                    };
                    await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                    services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
                }
                catch (err) {
                    console.error("Failed to fail PvP quest on PvE death:", err);
                }
            }
        }
        catch (err) {
            console.error("Failed to apply PvE death penalty:", err);
        }
    }
    async handleRespawn(user, message, socket, services) {
        const entry = services.presence.getEntry(user.id);
        if (!entry)
            return;
        const isVengeance = message.type === "respawn_vengeance";
        const vengeanceTargetUserId = isVengeance ? Number(message.killedByUserId) : null;
        const sector = services.sectorService.sectors.get(entry.sectorId) ??
            services.sectorService.findOrCreateSector(1, undefined, services.presence);
        entry.sectorId = sector.id;
        // Используем Math.random() для более случайного распределения при респавне
        const margin = 50;
        const spawnX = margin + Math.random() * (sector.config.width - margin * 2);
        const spawnY = margin + Math.random() * (sector.config.height - margin * 2);
        const rotation = 0;
        const monsterKey = (0, utils_1.normalizeMonsterChoice)(entry?.shipChoice);
        let level = entry.level || 1;
        let exp = 0;
        let expToNext = (0, utils_1.expToNextLevel)(level);
        let resources = { scrap: 0, tokens: 0 };
        const expRow = await services.db.Player.findOne({
            where: { userId: user.id },
            attributes: ["exp", "expToNext", "resources", "monsterProgress"],
        });
        if (expRow) {
            const progress = expRow.monsterProgress || {};
            const stored = (0, utils_1.getMonsterProgressEntry)(progress, monsterKey);
            if (stored) {
                level = Number(stored.level) || level;
                exp = Number(stored.exp) || 0;
                expToNext = Number(stored.expToNext) || (0, utils_1.expToNextLevel)(level);
            }
            else {
                exp = Number(expRow.exp) || 0;
                expToNext = Number(expRow.expToNext) || (0, utils_1.expToNextLevel)(level);
            }
            resources = expRow.resources || resources;
        }
        const stats = (0, utils_1.playerStatsForLevel)(level, monsterKey);
        const energyCap = (0, utils_1.energyCapForLevel)(level);
        const nextResources = { scrap: energyCap, tokens: Number(resources.tokens || 0) };
        const progress = expRow ? (expRow.monsterProgress || {}) : {};
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
        await services.db.Player.update({
            posX: spawnX,
            posY: spawnY,
            rotation,
            sectorId: sector.id,
            lastPositionAt: new Date(),
            lastHealthAt: new Date(),
            health: stats.maxHealth,
            maxHealth: stats.maxHealth,
            resources: nextResources,
            monsterProgress: nextProgress,
        }, { where: { userId: user.id } });
        const invulnerableUntil = Date.now() + 10000;
        const zone = sector.world.safeZone;
        const initialInSafeZone = zone &&
            zone.expiresAt > Date.now() &&
            services.sectorService.isInsideSafeZone(zone, spawnX, spawnY);
        entry.x = spawnX;
        entry.y = spawnY;
        entry.rotation = rotation;
        entry.health = stats.maxHealth;
        entry.maxHealth = stats.maxHealth;
        entry.level = level;
        entry.invulnerableUntil = invulnerableUntil;
        entry.isDead = false;
        entry.updatedAt = Date.now();
        entry.wasInSafeZone = !!initialInSafeZone;
        if (isVengeance && Number.isFinite(vengeanceTargetUserId) && vengeanceTargetUserId > 0) {
            entry.vengeanceTargetUserId = vengeanceTargetUserId;
            entry.vengeanceExpiresAt = Date.now() + constants_2.VENGEANCE_DURATION_MS;
            entry.huntedByUserId = undefined;
            entry.huntedExpiresAt = undefined;
        }
        else {
            entry.vengeanceTargetUserId = undefined;
            entry.vengeanceExpiresAt = undefined;
        }
        services.presence.setEntry(user.id, entry);
        const sockets = services.presence.getSockets(user.id);
        if (sockets) {
            for (const s of sockets) {
                s.sectorId = sector.id;
            }
        }
        if (entry.vengeanceExpiresAt && entry.vengeanceTargetUserId) {
            const targetUserId = entry.vengeanceTargetUserId;
            const targetEntry = services.presence.getEntry(targetUserId);
            const targetSector = targetEntry?.sectorId
                ? services.sectorService.sectors.get(targetEntry.sectorId)
                : null;
            services.broadcast.sendSelfUpdate(user.id, {
                vengeance: {
                    targetUserId,
                    targetNickname: targetEntry?.nickname ?? `Пилот ${targetUserId}`,
                    expiresAt: entry.vengeanceExpiresAt,
                    targetSectorId: targetEntry?.sectorId ?? null,
                    targetSectorName: targetSector?.name ?? null,
                },
                hunted: null,
            }, services.presence);
            if (targetEntry) {
                targetEntry.huntedByUserId = user.id;
                targetEntry.huntedExpiresAt = entry.vengeanceExpiresAt;
                targetEntry.updatedAt = Date.now();
                services.presence.setEntry(targetUserId, targetEntry);
                const huntedPayload = {
                    hunted: {
                        hunterUserId: user.id,
                        hunterNickname: entry.nickname ?? `Пилот ${user.id}`,
                        expiresAt: entry.vengeanceExpiresAt,
                    },
                };
                services.broadcast.sendSelfUpdate(targetUserId, huntedPayload, services.presence);
                if (targetEntry.sectorId)
                    services.broadcast.broadcastPresence(targetEntry.sectorId, services.presence);
            }
        }
        if (entry.huntedExpiresAt && entry.huntedByUserId && entry.huntedExpiresAt > Date.now()) {
            const hunterEntry = services.presence.getEntry(entry.huntedByUserId);
            services.broadcast.sendSelfUpdate(user.id, {
                hunted: {
                    hunterUserId: entry.huntedByUserId,
                    hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
                    expiresAt: entry.huntedExpiresAt,
                },
            }, services.presence);
        }
        try {
            const messages = await services.chat.loadChatHistory("sector", sector.id, services.db);
            const socks = services.presence.getSockets(user.id);
            if (socks) {
                const payload = JSON.stringify({
                    type: "chat_history",
                    scope: "sector",
                    sectorId: sector.id,
                    messages,
                });
                for (const s of socks) {
                    if (s.readyState === 1)
                        s.send(payload);
                }
            }
        }
        catch {
            // ignore
        }
        services.broadcast.broadcastPresence(sector.id, services.presence);
        services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        services.broadcast.sendPlayerUpdate(user.id, {
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
        }, services.presence);
        services.broadcast.sendSelfUpdate(user.id, { serverTime: Date.now(), invulnerableUntil }, services.presence);
    }
    async handleUseBlackHole(user, message, services) {
        const entry = services.presence.getEntry(user.id);
        if (!entry)
            return;
        startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = services.sectorService.sectors.get(entry.sectorId);
        const holes = Array.isArray(sector?.world.blackHoles) ? sector.world.blackHoles : [];
        if (!sector || holes.length === 0)
            return;
        const blackHoleId = message.blackHoleId;
        let hole = typeof blackHoleId === "string" && holes.find((h) => h.id === blackHoleId);
        if (!hole) {
            const now = Date.now();
            let nearestDist = Infinity;
            for (const h of holes) {
                if (h.expiresAt <= now || (h.appearsAt ?? 0) > now)
                    continue;
                const dist = Math.hypot(entry.x - h.x, entry.y - h.y);
                if (dist <= 90 && dist < nearestDist) {
                    nearestDist = dist;
                    hole = h;
                }
            }
        }
        const now = Date.now();
        if (!hole || hole.expiresAt <= now || (hole.appearsAt ?? 0) > now)
            return;
        const dx = entry.x - hole.x;
        const dy = entry.y - hole.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 90)
            return;
        const targetSectorId = hole.targetSectorId;
        const targetLevel = Number(hole.targetLevel);
        if (targetSectorId === entry.sectorId)
            return;
        const requiredLevel = constants_2.MIN_PLAYER_LEVEL_FOR_SECTOR_LEVEL[targetLevel] ?? 1;
        const playerLevel = entry.level ?? 1;
        if (playerLevel < requiredLevel)
            return;
        const holeId = hole.id;
        sector.world.blackHoles = sector.world.blackHoles.filter((h) => h.id !== holeId);
        services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        if (targetSectorId && Number.isFinite(targetLevel)) {
            await this.movePlayerToSectorById(user.id, targetSectorId, targetLevel, services);
            return;
        }
        await this.movePlayerToSector(user.id, sector.level, services);
    }
    async movePlayerToSector(userId, nextLevel, services) {
        const entry = services.presence.getEntry(userId);
        if (!entry)
            return;
        const previousSector = entry.sectorId ? services.sectorService.sectors.get(entry.sectorId) : null;
        const targetSector = services.sectorService.findOrCreateSector(nextLevel, previousSector?.id, services.presence);
        // При переходе в другой сектор удаляем все активные квесты текущего сектора
        if (previousSector && previousSector.id !== targetSector.id) {
            try {
                // Убираем флаг hasPvpQuest при переходе в другой сектор
                if (entry.hasPvpQuest) {
                    entry.hasPvpQuest = false;
                    services.presence.setEntry(userId, entry);
                    services.broadcast.broadcastPresence(previousSector.id, services.presence);
                }
                // Удаляем все активные квесты текущего сектора (без questType = удалить все типы)
                await services.quest.cancelQuest(userId, previousSector.id);
            }
            catch (err) {
                console.error("Failed to cancel quest on sector change:", err);
            }
        }
        // Проверяем активные квесты для нового сектора (не создаем автоматически)
        try {
            const allActiveQuests = await services.quest.getAllActiveQuests(userId, targetSector.id);
            const sectorName = services.sectorService.getSectorDisplayName(targetSector);
            const sockets = services.presence.getSockets(userId);
            if (allActiveQuests.length > 0 && sockets) {
                // Отправляем все активные квесты
                for (const activeQuest of allActiveQuests) {
                    const questWithName = { ...activeQuest, sectorName };
                    const payload = JSON.stringify({
                        type: "quest_progress",
                        quest: questWithName,
                        sectorId: targetSector.id,
                        sectorName: sectorName,
                        available: true,
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(payload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
            }
            else if (sockets) {
                // Если активных квестов нет, отправляем информацию о секторе
                const questInfo = await services.quest.getQuestInfo(userId, targetSector.id);
                const payload = JSON.stringify({
                    type: "quest_progress",
                    quest: null,
                    available: questInfo.available,
                    sectorId: targetSector.id,
                    sectorName: sectorName,
                    completedAt: questInfo.completedAt,
                    timeUntilReset: questInfo.timeUntilReset,
                });
                for (const s of sockets) {
                    if (s.readyState === 1) {
                        try {
                            s.send(payload);
                        }
                        catch {
                            // ignore
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error("Failed to load quests on sector change:", err);
        }
        // Используем Math.random() для более случайного распределения при переходе между секторами
        const margin = 50;
        const spawnX = margin + Math.random() * (targetSector.config.width - margin * 2);
        const spawnY = margin + Math.random() * (targetSector.config.height - margin * 2);
        const zone = targetSector.world.safeZone;
        const initialInSafeZone = zone &&
            zone.expiresAt > Date.now() &&
            services.sectorService.isInsideSafeZone(zone, spawnX, spawnY);
        entry.sectorId = targetSector.id;
        entry.x = spawnX;
        entry.y = spawnY;
        entry.rotation = 0;
        entry.invulnerableUntil = Date.now() + 10000;
        entry.updatedAt = Date.now();
        entry.wasInSafeZone = !!initialInSafeZone;
        services.presence.setEntry(userId, entry);
        const sockets = services.presence.getSockets(userId);
        if (sockets)
            for (const s of sockets)
                s.sectorId = targetSector.id;
        if (previousSector) {
            services.broadcast.broadcastPresence(previousSector.id, services.presence);
            services.broadcast.broadcastWorld(previousSector.id, services.sectorService, services.presence);
        }
        services.broadcast.broadcastPresence(targetSector.id, services.presence);
        services.broadcast.broadcastWorld(targetSector.id, services.sectorService, services.presence);
        services.broadcast.notifyHuntersOfTargetSectorChange(userId, services.presence, services.sectorService);
        services.broadcast.sendPlayerUpdate(userId, { posX: spawnX, posY: spawnY, rotation: 0, lastPositionAt: new Date().toISOString() }, services.presence);
        services.broadcast.sendSelfUpdate(userId, { serverTime: Date.now(), invulnerableUntil: entry.invulnerableUntil }, services.presence);
        try {
            const messages = await services.chat.loadChatHistory("sector", targetSector.id, services.db);
            const socks = services.presence.getSockets(userId);
            if (socks) {
                const payload = JSON.stringify({ type: "chat_history", scope: "sector", sectorId: targetSector.id, messages });
                for (const s of socks)
                    if (s.readyState === 1)
                        s.send(payload);
            }
        }
        catch {
            // ignore
        }
        try {
            await services.db.Player.update({
                posX: spawnX,
                posY: spawnY,
                rotation: 0,
                sectorId: targetSector.id,
                lastPositionAt: new Date(),
            }, { where: { userId } });
        }
        catch (err) {
            console.error("Failed to persist sector travel:", err);
        }
    }
    async movePlayerToSectorById(userId, targetSectorId, fallbackLevel, services) {
        const entry = services.presence.getEntry(userId);
        if (!entry)
            return;
        const previousSector = services.sectorService.sectors.get(entry.sectorId);
        const targetSector = services.sectorService.sectors.get(targetSectorId) ??
            services.sectorService.createSector(Number.isFinite(fallbackLevel) ? fallbackLevel : previousSector?.level ?? 1);
        // Отменяем квест при переходе в другой сектор
        if (previousSector && previousSector.id !== targetSectorId) {
            try {
                // Убираем флаг hasPvpQuest при переходе в другой сектор
                if (entry.hasPvpQuest) {
                    entry.hasPvpQuest = false;
                    services.presence.setEntry(userId, entry);
                    services.broadcast.broadcastPresence(previousSector.id, services.presence);
                }
                await services.quest.cancelQuest(userId, previousSector.id);
            }
            catch (err) {
                console.error("Failed to cancel quest on sector change:", err);
            }
        }
        // Проверяем активные квесты для нового сектора (не создаем автоматически)
        try {
            const allActiveQuests = await services.quest.getAllActiveQuests(userId, targetSector.id);
            const sectorName = services.sectorService.getSectorDisplayName(targetSector);
            const sockets = services.presence.getSockets(userId);
            if (allActiveQuests.length > 0 && sockets) {
                // Отправляем все активные квесты
                for (const activeQuest of allActiveQuests) {
                    const questWithName = { ...activeQuest, sectorName };
                    const payload = JSON.stringify({
                        type: "quest_progress",
                        quest: questWithName,
                        sectorId: targetSector.id,
                        sectorName: sectorName,
                        available: true,
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(payload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
            }
            else if (sockets) {
                // Если активных квестов нет, отправляем информацию о секторе
                const questInfo = await services.quest.getQuestInfo(userId, targetSector.id);
                const payload = JSON.stringify({
                    type: "quest_progress",
                    quest: null,
                    available: questInfo.available,
                    sectorId: targetSector.id,
                    sectorName: sectorName,
                    completedAt: questInfo.completedAt,
                    timeUntilReset: questInfo.timeUntilReset,
                });
                for (const s of sockets) {
                    if (s.readyState === 1) {
                        try {
                            s.send(payload);
                        }
                        catch {
                            // ignore
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error("Failed to load quests on sector change:", err);
        }
        // Используем Math.random() для более случайного распределения при переходе между секторами
        const margin = 50;
        const spawnX = margin + Math.random() * (targetSector.config.width - margin * 2);
        const spawnY = margin + Math.random() * (targetSector.config.height - margin * 2);
        const zone = targetSector.world.safeZone;
        const initialInSafeZone = zone &&
            zone.expiresAt > Date.now() &&
            services.sectorService.isInsideSafeZone(zone, spawnX, spawnY);
        entry.sectorId = targetSector.id;
        entry.x = spawnX;
        entry.y = spawnY;
        entry.rotation = 0;
        entry.invulnerableUntil = Date.now() + 10000;
        entry.updatedAt = Date.now();
        entry.wasInSafeZone = !!initialInSafeZone;
        services.presence.setEntry(userId, entry);
        const sockets = services.presence.getSockets(userId);
        if (sockets)
            for (const s of sockets)
                s.sectorId = targetSector.id;
        if (previousSector) {
            services.broadcast.broadcastPresence(previousSector.id, services.presence);
            services.broadcast.broadcastWorld(previousSector.id, services.sectorService, services.presence);
        }
        services.broadcast.broadcastPresence(targetSector.id, services.presence);
        services.broadcast.broadcastWorld(targetSector.id, services.sectorService, services.presence);
        services.broadcast.notifyHuntersOfTargetSectorChange(userId, services.presence, services.sectorService);
        services.broadcast.sendPlayerUpdate(userId, { posX: spawnX, posY: spawnY, rotation: 0, lastPositionAt: new Date().toISOString() }, services.presence);
        services.broadcast.sendSelfUpdate(userId, { serverTime: Date.now(), invulnerableUntil: entry.invulnerableUntil }, services.presence);
        try {
            const messages = await services.chat.loadChatHistory("sector", targetSector.id, services.db);
            const socks = services.presence.getSockets(userId);
            if (socks) {
                const payload = JSON.stringify({ type: "chat_history", scope: "sector", sectorId: targetSector.id, messages });
                for (const s of socks)
                    if (s.readyState === 1)
                        s.send(payload);
            }
        }
        catch {
            // ignore
        }
        // Проверяем активные квесты для нового сектора (не создаем автоматически)
        try {
            const allActiveQuests = await services.quest.getAllActiveQuests(userId, targetSector.id);
            const sectorName = services.sectorService.getSectorDisplayName(targetSector);
            const socks = services.presence.getSockets(userId);
            if (allActiveQuests.length > 0 && socks) {
                // Отправляем все активные квесты
                for (const activeQuest of allActiveQuests) {
                    const questWithName = { ...activeQuest, sectorName };
                    const payload = JSON.stringify({
                        type: "quest_progress",
                        quest: questWithName,
                        sectorId: targetSector.id,
                        sectorName: sectorName,
                        available: true,
                    });
                    for (const s of socks) {
                        if (s.readyState === 1) {
                            try {
                                s.send(payload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
            }
            else if (socks) {
                // Если активных квестов нет, отправляем информацию о секторе
                const questInfo = await services.quest.getQuestInfo(userId, targetSector.id);
                const payload = JSON.stringify({
                    type: "quest_progress",
                    quest: null,
                    available: questInfo.available,
                    sectorId: targetSector.id,
                    sectorName: sectorName,
                    completedAt: questInfo.completedAt,
                    timeUntilReset: questInfo.timeUntilReset,
                });
                for (const s of socks) {
                    if (s.readyState === 1) {
                        try {
                            s.send(payload);
                        }
                        catch {
                            // ignore
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error("Failed to load quests on sector change:", err);
        }
        try {
            await services.db.Player.update({
                posX: spawnX,
                posY: spawnY,
                rotation: 0,
                sectorId: targetSector.id,
                lastPositionAt: new Date(),
            }, { where: { userId } });
        }
        catch (err) {
            console.error("Failed to persist sector travel:", err);
        }
    }
    async handlePickupCollect(user, message, services) {
        const pickupId = Number(message.pickupId);
        const entry = services.presence.getEntry(user.id);
        if (entry)
            startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        if (!sector)
            return;
        const pickup = sector.world.pickups.get(pickupId);
        if (pickup) {
            sector.world.pickups.delete(pickupId);
            if (pickup.resource === "tokens" && (pickup.amount == null || pickup.amount > 0)) {
                const addTokens = Math.max(1, Number(pickup.amount) || 1);
                try {
                    const player = await services.db.Player.findOne({
                        where: { userId: user.id },
                        attributes: ["resources"],
                    });
                    if (player) {
                        const resources = player.resources || { scrap: 0, tokens: 0 };
                        const nextResources = {
                            scrap: Number(resources.scrap ?? 0) || 0,
                            tokens: (Number(resources.tokens ?? 0) || 0) + addTokens,
                        };
                        await services.db.Player.update({ resources: nextResources }, { where: { userId: user.id } });
                        services.broadcast.sendPlayerUpdate(user.id, { resources: nextResources }, services.presence);
                    }
                }
                catch (err) {
                    console.error("Failed to grant token pickup:", err);
                }
            }
            else if (pickup.resource !== "tokens") {
                setTimeout(() => {
                    services.sectorService.spawnPickupPublic(sector, pickup.resource, (0, utils_1.randBetween)(100, sector.config.width - 100), (0, utils_1.randBetween)(100, sector.config.height - 100));
                    services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
                }, constants_2.PICKUP_RESPAWN_MS);
            }
            services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        }
    }
    handleSkillImmunity(user, message, services) {
        const entry = services.presence.getEntry(user.id);
        if (entry)
            startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        const zone = sector?.world?.safeZone;
        if (entry &&
            (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))) {
            const durationMs = Math.min(10000, Math.max(1000, Number(message.durationMs) || 5000));
            entry.invulnerableUntil = Date.now() + durationMs;
            services.broadcast.broadcastPresence(entry.sectorId, services.presence);
            services.broadcast.sendSelfUpdate(user.id, { serverTime: Date.now(), invulnerableUntil: entry.invulnerableUntil }, services.presence);
        }
    }
    handleSkillHealing(user, message, services) {
        const entry = services.presence.getEntry(user.id);
        if (entry)
            startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        const zone = sector?.world?.safeZone;
        if (entry &&
            (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))) {
            const durationMs = Math.min(10000, Math.max(1000, Number(message.durationMs) || 5000));
            entry.healingExpiresAt = Date.now() + durationMs;
            entry.lastHealingRegenAt = 0;
            services.broadcast.broadcastPresence(entry.sectorId, services.presence);
        }
    }
    handleSkillFury(user, message, services) {
        const entry = services.presence.getEntry(user.id);
        if (entry)
            startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        const zone = sector?.world?.safeZone;
        if (entry &&
            (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))) {
            const durationMs = Math.min(15000, Math.max(1000, Number(message.durationMs) || 7000));
            entry.furyExpiresAt = Date.now() + durationMs;
            services.broadcast.broadcastPresence(entry.sectorId, services.presence);
        }
    }
    handleSkillGravityPit(user, message, services) {
        const entry = services.presence.getEntry(user.id);
        if (entry)
            startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        const zone = sector?.world?.safeZone;
        if (entry &&
            sector &&
            (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))) {
            const margin = 100;
            const x = Math.min(sector.config.width - margin, Math.max(margin, entry.x));
            const y = Math.min(sector.config.height - margin, Math.max(margin, entry.y));
            if (!Array.isArray(sector.world.gravityPits))
                sector.world.gravityPits = [];
            sector.world.gravityPits.push({
                id: `gp-${Date.now()}-${(0, utils_1.randInt)(100, 999)}`,
                x,
                y,
                radius: constants_2.GRAVITY_PIT_RADIUS,
                expiresAt: Date.now() + constants_2.GRAVITY_PIT_DURATION_MS,
                ownerUserId: user.id,
            });
            services.broadcast.broadcastWorld(entry.sectorId, services.sectorService, services.presence);
        }
    }
    handleSkillTeleport(user, message, socket, services) {
        const entry = services.presence.getEntry(user.id);
        if (entry)
            startSpawnImmunityIfNeeded(entry, user.id, services);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        const zone = sector?.world?.safeZone;
        if (entry &&
            sector &&
            (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))) {
            const width = sector.config.width;
            const height = sector.config.height;
            const margin = 120;
            setTimeout(() => {
                const current = services.presence.getEntry(user.id);
                const currentSector = current ? services.sectorService.sectors.get(current.sectorId) : null;
                if (!current || !currentSector || currentSector.id !== sector.id)
                    return;
                const x = (0, utils_1.randBetween)(margin, width - margin);
                const y = (0, utils_1.randBetween)(margin, height - margin);
                current.x = x;
                current.y = y;
                current.updatedAt = Date.now();
                services.presence.setEntry(user.id, current);
                services.broadcast.broadcastPresence(current.sectorId, services.presence);
                try {
                    socket.send(JSON.stringify({ type: "teleport_complete", x, y }));
                }
                catch {
                    // client may have disconnected
                }
            }, 3000);
        }
    }
    async handleEnemyHit(user, message, services) {
        const enemyId = Number(message.enemyId);
        const requestedDamage = Math.max(0, Number(message.damage || 0));
        const presenceEntry = services.presence.getEntry(user.id);
        if (presenceEntry)
            startSpawnImmunityIfNeeded(presenceEntry, user.id, services);
        const level = presenceEntry?.level || 1;
        const maxDamage = (0, utils_1.playerStatsForLevel)(level, presenceEntry?.shipChoice).damage;
        const continuousLaser = Boolean(message.continuousLaser);
        const damageCap = continuousLaser ? maxDamage * 3 : maxDamage;
        let damage = Math.min(requestedDamage || 0, damageCap);
        const now = Date.now();
        if (presenceEntry?.furyExpiresAt && presenceEntry.furyExpiresAt > now) {
            damage = Math.round(damage * constants_2.FURY_DAMAGE_MULT);
        }
        const sector = presenceEntry ? services.sectorService.sectors.get(presenceEntry.sectorId) : null;
        if (!sector)
            return;
        const enemy = sector.world.enemies.get(enemyId);
        if (enemy && damage > 0) {
            enemy.health = Math.max(0, enemy.health - damage);
            if (enemy.health <= 0) {
                sector.world.enemies.delete(enemyId);
                const playerIsDead = presenceEntry?.isDead ?? false;
                if (playerIsDead) {
                    services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
                }
                else {
                    const expGain = Math.max(1, Math.floor((25 + enemy.level * 10) / 5));
                    const tokenAmount = (0, utils_1.tokensForMobLevel)(enemy.level);
                    const tokenId = services.sectorService.spawnPickupPublic(sector, "tokens", enemy.x, enemy.y, tokenAmount);
                    services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
                    setTimeout(() => {
                        if (sector.world.pickups.delete(tokenId)) {
                            services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
                        }
                    }, constants_2.PICKUP_RESPAWN_MS);
                    try {
                        const progress = await services.player.awardPlayerExp(user.id, expGain, presenceEntry?.shipChoice, services.db);
                        if (progress) {
                            services.broadcast.sendPlayerUpdate(user.id, progress, services.presence);
                            if (presenceEntry) {
                                presenceEntry.level = progress.level;
                                presenceEntry.maxHealth = progress.maxHealth;
                                if (typeof progress.health === "number")
                                    presenceEntry.health = progress.health;
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
                                    await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                                    services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
                                }
                                catch {
                                    // ignore
                                }
                            }
                        }
                    }
                    catch (err) {
                        console.error("Failed to award exp:", err);
                    }
                    // Отслеживаем убийство моба для квеста
                    if (presenceEntry?.sectorId) {
                        try {
                            const questProgress = await services.quest.incrementKills(user.id, presenceEntry.sectorId);
                            if (questProgress) {
                                // Добавляем название сектора
                                const sector = services.sectorService.sectors.get(presenceEntry.sectorId);
                                const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : undefined;
                                const questProgressWithName = { ...questProgress, sectorName };
                                // Отправляем обновление прогресса квеста
                                const sockets = services.presence.getSockets(user.id);
                                if (sockets) {
                                    const payload = JSON.stringify({
                                        type: "quest_progress",
                                        quest: questProgressWithName,
                                    });
                                    for (const s of sockets) {
                                        if (s.readyState === 1) {
                                            try {
                                                s.send(payload);
                                            }
                                            catch {
                                                // ignore
                                            }
                                        }
                                    }
                                }
                                // Если квест выполнен успешно, выдаем награду
                                // Проверяем, что квест относится к текущему сектору игрока
                                if (questProgress.completedAt && questProgress.killsCompleted >= questProgress.killsRequired) {
                                    if (questProgress.sectorId !== presenceEntry.sectorId) {
                                        console.warn(`[MessageHandler] Quest sector mismatch: quest.sectorId=${questProgress.sectorId}, player.sectorId=${presenceEntry.sectorId}`);
                                        // Не выдаем награду за квест из другого сектора, продолжаем обработку
                                    }
                                    else {
                                        console.log(`[MessageHandler] Completing quest ${questProgress.id} for sector ${questProgress.sectorId}`);
                                        const reward = await services.quest.completeQuest(questProgress.id, user.id, presenceEntry.sectorId, presenceEntry.shipChoice);
                                        if (reward) {
                                            // Получаем обновленный квест с completedAt для отправки клиенту
                                            const completedQuest = await services.quest.getQuestById(questProgress.id);
                                            // Выдаем опыт
                                            if (reward.exp) {
                                                const progress = await services.player.awardPlayerExp(user.id, reward.exp, presenceEntry.shipChoice, services.db);
                                                if (progress) {
                                                    services.broadcast.sendPlayerUpdate(user.id, progress, services.presence);
                                                    if (presenceEntry) {
                                                        presenceEntry.level = progress.level;
                                                        presenceEntry.maxHealth = progress.maxHealth;
                                                        if (typeof progress.health === "number")
                                                            presenceEntry.health = progress.health;
                                                    }
                                                }
                                            }
                                            // Обновляем ресурсы (токены уже выданы в completeQuest)
                                            const player = await services.db.Player.findOne({
                                                where: { userId: user.id },
                                                attributes: ["resources"],
                                            });
                                            if (player) {
                                                services.broadcast.sendPlayerUpdate(user.id, { resources: player.resources }, services.presence);
                                            }
                                            // Отправляем обновленный quest_progress с completedAt клиенту
                                            if (completedQuest) {
                                                // Добавляем название сектора
                                                const sector = services.sectorService.sectors.get(presenceEntry.sectorId || "");
                                                const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : undefined;
                                                const completedQuestWithName = { ...completedQuest, sectorName };
                                                const sockets = services.presence.getSockets(user.id);
                                                if (sockets) {
                                                    const payload = JSON.stringify({
                                                        type: "quest_progress",
                                                        quest: completedQuestWithName,
                                                    });
                                                    for (const s of sockets) {
                                                        if (s.readyState === 1) {
                                                            try {
                                                                s.send(payload);
                                                            }
                                                            catch {
                                                                // ignore
                                                            }
                                                        }
                                                    }
                                                    // Отправляем полное обновление сектора (questInfo + activeQuests), чтобы клиент показал квест перечёркнутым и убрал из активных
                                                    const allActiveQuestsAfter = await services.quest.getAllActiveQuests(user.id, presenceEntry.sectorId);
                                                    const mobQuestInfoAfter = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "mob_kills");
                                                    const pvpQuestInfoAfter = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "pvp_kills");
                                                    const sectorPayload = JSON.stringify({
                                                        type: "quest_progress",
                                                        quest: null,
                                                        sectorId: presenceEntry.sectorId,
                                                        sectorName: sectorName ?? "",
                                                        available: mobQuestInfoAfter.available || pvpQuestInfoAfter.available,
                                                        completedAt: mobQuestInfoAfter.completedAt ?? pvpQuestInfoAfter.completedAt ?? null,
                                                        timeUntilReset: mobQuestInfoAfter.timeUntilReset ?? pvpQuestInfoAfter.timeUntilReset ?? null,
                                                        questInfo: {
                                                            mob_kills: mobQuestInfoAfter,
                                                            pvp_kills: pvpQuestInfoAfter,
                                                        },
                                                        activeQuests: allActiveQuestsAfter.map((q) => ({ ...q, sectorName })),
                                                    });
                                                    for (const s of sockets) {
                                                        if (s.readyState === 1) {
                                                            try {
                                                                s.send(sectorPayload);
                                                            }
                                                            catch {
                                                                // ignore
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        // Отправляем сообщение о завершении квеста
                                        if (reward) {
                                            try {
                                                const nickname = presenceEntry?.nickname ?? "Игрок";
                                                // Получаем название сектора
                                                const sector = services.sectorService.sectors.get(presenceEntry.sectorId || "");
                                                const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : "секторе";
                                                const chatEntry = {
                                                    id: `quest-${Date.now()}-${user.id}`,
                                                    userId: user.id,
                                                    nickname: "Система",
                                                    text: `${nickname} выполнил ежедневный квест в ${sectorName}! Награда: +${reward.exp} опыта, +${reward.tokens} токенов.`,
                                                    createdAt: Date.now(),
                                                };
                                                await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                                                services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
                                            }
                                            catch {
                                                // ignore
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                // Квест истёк по времени или был удалён - отправляем обновление клиенту
                                const sector = services.sectorService.sectors.get(presenceEntry.sectorId);
                                const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : undefined;
                                const allActiveQuests = await services.quest.getAllActiveQuests(user.id, presenceEntry.sectorId);
                                const mobQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "mob_kills");
                                const pvpQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "pvp_kills");
                                const sockets = services.presence.getSockets(user.id);
                                if (sockets) {
                                    // Отправляем активные квесты (если есть)
                                    if (allActiveQuests.length > 0) {
                                        for (const activeQuest of allActiveQuests) {
                                            const questWithName = { ...activeQuest, sectorName };
                                            const payload = JSON.stringify({
                                                type: "quest_progress",
                                                quest: questWithName,
                                                sectorId: presenceEntry.sectorId,
                                                sectorName: sectorName,
                                            });
                                            for (const s of sockets) {
                                                if (s.readyState === 1) {
                                                    try {
                                                        s.send(payload);
                                                    }
                                                    catch {
                                                        // ignore
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    // Отправляем информацию о секторе
                                    const payload = JSON.stringify({
                                        type: "quest_progress",
                                        quest: null,
                                        sectorId: presenceEntry.sectorId,
                                        sectorName: sectorName,
                                        available: mobQuestInfo.available || pvpQuestInfo.available,
                                        completedAt: mobQuestInfo.completedAt || pvpQuestInfo.completedAt,
                                        timeUntilReset: mobQuestInfo.timeUntilReset || pvpQuestInfo.timeUntilReset,
                                        questInfo: {
                                            mob_kills: mobQuestInfo,
                                            pvp_kills: pvpQuestInfo,
                                        },
                                        activeQuests: allActiveQuests.map((q) => ({ ...q, sectorName })),
                                    });
                                    for (const s of sockets) {
                                        if (s.readyState === 1) {
                                            try {
                                                s.send(payload);
                                            }
                                            catch {
                                                // ignore
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch (err) {
                            console.error("Failed to update quest progress:", err);
                        }
                    }
                }
                setTimeout(() => {
                    services.sectorService.spawnEnemyPublic(sector);
                    services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
                }, constants_2.ENEMY_RESPAWN_MS);
            }
            else {
                services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
            }
        }
    }
    handleAsteroidDestroy(user, message, services) {
        const asteroidId = Number(message.asteroidId);
        const entry = services.presence.getEntry(user.id);
        const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
        if (sector && sector.world.asteroids.delete(asteroidId)) {
            services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        }
    }
    async handleChatMessage(user, message, services) {
        const text = String(message.text ?? "").trim();
        if (!text)
            return;
        const safeText = text.slice(0, 240);
        const scope = message.scope === "private" ? "private" : message.scope === "global" ? "global" : "sector";
        const entry = services.presence.getEntry(user.id);
        const sectorId = entry?.sectorId ?? "unknown";
        const nickname = entry?.nickname ?? user.nickname ?? `Пилот ${user.id}`;
        if (scope === "private") {
            const targetUserId = Number(message.targetUserId);
            if (!Number.isFinite(targetUserId) || targetUserId <= 0 || targetUserId === user.id)
                return;
            if (!services.presence.hasClient(targetUserId))
                return;
            const chatEntry = {
                id: `pm-${Date.now()}-${user.id}-${targetUserId}`,
                userId: user.id,
                nickname,
                text: safeText,
                createdAt: Date.now(),
                targetUserId,
            };
            await services.chat.persistChatMessage(chatEntry, "private", "", services.db, targetUserId);
            services.broadcast.sendPrivateChat(chatEntry, user.id, targetUserId, services.presence);
            return;
        }
        const chatEntry = {
            id: `${Date.now()}-${user.id}`,
            userId: user.id,
            nickname,
            text: safeText,
            createdAt: Date.now(),
        };
        await services.chat.persistChatMessage(chatEntry, scope, sectorId, services.db);
        services.broadcast.broadcastChat(chatEntry, scope, sectorId, services.presence);
    }
    async handleChatHistoryRequest(user, message, socket, services) {
        const scope = message.scope === "private" ? "private" : message.scope === "global" ? "global" : "sector";
        if (scope === "private") {
            const targetUserId = Number(message.targetUserId);
            if (!Number.isFinite(targetUserId) || targetUserId <= 0)
                return;
            const messages = await services.chat.loadChatHistory("private", undefined, services.db, user.id, targetUserId);
            try {
                socket.send(JSON.stringify({
                    type: "chat_history",
                    scope: "private",
                    targetUserId,
                    messages,
                }));
            }
            catch {
                // ignore
            }
            return;
        }
        if (scope === "global") {
            const messages = await services.chat.loadChatHistory("global", undefined, services.db);
            try {
                socket.send(JSON.stringify({
                    type: "chat_history",
                    scope: "global",
                    messages,
                }));
            }
            catch {
                // ignore
            }
            return;
        }
        const entry = services.presence.getEntry(user.id);
        const sectorId = entry?.sectorId;
        if (!sectorId)
            return;
        const messages = await services.chat.loadChatHistory("sector", sectorId, services.db);
        try {
            socket.send(JSON.stringify({
                type: "chat_history",
                scope: "sector",
                sectorId,
                messages,
            }));
        }
        catch {
            // ignore
        }
    }
    async handleStartQuest(user, message, services) {
        const presenceEntry = services.presence.getEntry(user.id);
        if (!presenceEntry?.sectorId)
            return;
        try {
            // Получаем тип квеста из сообщения (по умолчанию mob_kills)
            const questType = message.questType || "mob_kills";
            // Получаем информацию о секторе
            const sector = services.sectorService.sectors.get(presenceEntry.sectorId);
            const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : undefined;
            // Проверяем, разрешены ли PvP квесты в этом секторе (белые сектора не имеют PvP квестов)
            if (questType === "pvp_kills") {
                const pvpAllowed = sector?.config?.pvpAllowed ?? false;
                if (!pvpAllowed) {
                    // Белый сектор - PvP квесты недоступны
                    const sockets = services.presence.getSockets(user.id);
                    if (sockets) {
                        const payload = JSON.stringify({
                            type: "quest_progress",
                            quest: null,
                            error: "PvP квесты недоступны в белых секторах",
                            available: false,
                        });
                        for (const s of sockets) {
                            if (s.readyState === 1) {
                                try {
                                    s.send(payload);
                                }
                                catch {
                                    // ignore
                                }
                            }
                        }
                    }
                    return;
                }
            }
            // Проверяем, есть ли уже активный квест этого типа
            const allActiveQuests = await services.quest.getAllActiveQuests(user.id, presenceEntry.sectorId);
            const activeQuestOfType = allActiveQuests.find(q => q.questType === questType);
            if (activeQuestOfType) {
                // Добавляем название сектора
                const questWithName = { ...activeQuestOfType, sectorName };
                // Отправляем существующий квест
                const sockets = services.presence.getSockets(user.id);
                if (sockets) {
                    const payload = JSON.stringify({
                        type: "quest_progress",
                        quest: questWithName,
                        available: true,
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(payload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                    // Полное состояние сектора, чтобы mob-квест оставался «выполнен»
                    const mobQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "mob_kills");
                    const pvpQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "pvp_kills");
                    const sectorPayload = JSON.stringify({
                        type: "quest_progress",
                        quest: null,
                        sectorId: presenceEntry.sectorId,
                        sectorName: sectorName ?? "",
                        available: mobQuestInfo.available || pvpQuestInfo.available,
                        completedAt: mobQuestInfo.completedAt ?? pvpQuestInfo.completedAt ?? null,
                        timeUntilReset: mobQuestInfo.timeUntilReset ?? pvpQuestInfo.timeUntilReset ?? null,
                        questInfo: {
                            mob_kills: mobQuestInfo,
                            pvp_kills: pvpQuestInfo,
                        },
                        activeQuests: allActiveQuests.map((q) => ({ ...q, sectorName })),
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(sectorPayload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
                // Обновляем флаг hasPvpQuest если это PvP квест
                if (questType === "pvp_kills" && !presenceEntry.hasPvpQuest) {
                    presenceEntry.hasPvpQuest = true;
                    services.presence.setEntry(user.id, presenceEntry);
                    services.broadcast.broadcastPresence(presenceEntry.sectorId, services.presence);
                }
                return;
            }
            // Создаем новый квест указанного типа
            const questProgress = await services.quest.createQuest(user.id, presenceEntry.sectorId, questType);
            if (questProgress) {
                // Добавляем название сектора
                const questWithName = { ...questProgress, sectorName };
                const sockets = services.presence.getSockets(user.id);
                if (sockets) {
                    const payload = JSON.stringify({
                        type: "quest_progress",
                        quest: questWithName,
                        available: true,
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(payload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                    // Полное состояние сектора (questInfo + activeQuests), чтобы mob-квест оставался «выполнен», а не сбрасывался
                    const allActiveQuestsAfter = await services.quest.getAllActiveQuests(user.id, presenceEntry.sectorId);
                    const mobQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "mob_kills");
                    const pvpQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "pvp_kills");
                    const sectorPayload = JSON.stringify({
                        type: "quest_progress",
                        quest: null,
                        sectorId: presenceEntry.sectorId,
                        sectorName: sectorName ?? "",
                        available: mobQuestInfo.available || pvpQuestInfo.available,
                        completedAt: mobQuestInfo.completedAt ?? pvpQuestInfo.completedAt ?? null,
                        timeUntilReset: mobQuestInfo.timeUntilReset ?? pvpQuestInfo.timeUntilReset ?? null,
                        questInfo: {
                            mob_kills: mobQuestInfo,
                            pvp_kills: pvpQuestInfo,
                        },
                        activeQuests: allActiveQuestsAfter.map((q) => ({ ...q, sectorName })),
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(sectorPayload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
            }
            else {
                // Квест уже выполнен сегодня в этом секторе
                const sockets = services.presence.getSockets(user.id);
                if (sockets) {
                    const payload = JSON.stringify({
                        type: "quest_progress",
                        quest: null,
                        error: "Квест уже выполнен сегодня в этом секторе",
                        available: false,
                    });
                    for (const s of sockets) {
                        if (s.readyState === 1) {
                            try {
                                s.send(payload);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error("Failed to start quest:", err);
        }
    }
    async handleCancelQuest(user, message, services) {
        const presenceEntry = services.presence.getEntry(user.id);
        if (!presenceEntry?.sectorId)
            return;
        try {
            // Получаем тип квеста из сообщения (если не указан, отменяем все - для совместимости)
            const questType = message.questType;
            // Проверяем, есть ли активный квест перед отменой
            const allActiveQuests = await services.quest.getAllActiveQuests(user.id, presenceEntry.sectorId);
            const hasPvpQuest = allActiveQuests.some(q => q.questType === "pvp_kills");
            const questToCancel = questType ? allActiveQuests.find(q => q.questType === questType) : null;
            // Дополнительная проверка: ищем квест напрямую в БД для диагностики
            const whereClause = {
                userId: user.id,
                sectorId: presenceEntry.sectorId,
                completedAt: null,
            };
            if (questType) {
                whereClause.questType = questType;
            }
            const directQuestCheck = await services.db.DailyQuest.findAll({
                where: whereClause,
            });
            console.log(`[MessageHandler] Cancel quest request: userId=${user.id}, sectorId=${presenceEntry.sectorId}, questType=${questType}, foundActiveQuest=${!!questToCancel}, totalActiveQuests=${allActiveQuests.length}, directDbCheck=${directQuestCheck.length}`);
            // Если getAllActiveQuests не нашёл квест, но он есть в БД, возможно он истёк
            if (directQuestCheck.length > 0 && allActiveQuests.length === 0) {
                console.log(`[MessageHandler] WARNING: Found ${directQuestCheck.length} quest(s) in DB but getAllActiveQuests returned 0. Checking expiration...`);
                for (const q of directQuestCheck) {
                    const expiresAt = new Date(q.expiresAt).getTime();
                    const now = Date.now();
                    console.log(`[MessageHandler] Quest ${q.id}: expiresAt=${new Date(expiresAt).toISOString()}, now=${new Date(now).toISOString()}, expired=${now >= expiresAt}`);
                }
            }
            const cancelled = await services.quest.cancelQuest(user.id, presenceEntry.sectorId, questType);
            // Убираем флаг hasPvpQuest если был активный PvP квест и он был отменен
            if (questType === "pvp_kills" && hasPvpQuest && presenceEntry.hasPvpQuest) {
                presenceEntry.hasPvpQuest = false;
                services.presence.setEntry(user.id, presenceEntry);
                services.broadcast.broadcastPresence(presenceEntry.sectorId, services.presence);
            }
            // Всегда отправляем обновление клиенту, даже если не было найдено активных квестов для отмены
            // (например, квест уже был отменен ранее, но клиент все еще показывает его как активный)
            const allActiveQuestsAfterCancel = await services.quest.getAllActiveQuests(user.id, presenceEntry.sectorId);
            const sectorName = services.sectorService.getSectorDisplayName(services.sectorService.sectors.get(presenceEntry.sectorId));
            const sockets = services.presence.getSockets(user.id);
            if (sockets) {
                const mobQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "mob_kills");
                const pvpQuestInfo = await services.quest.getQuestInfo(user.id, presenceEntry.sectorId, "pvp_kills");
                // Одно сообщение с полным состоянием сектора, чтобы клиент обновил UI атомарно (без гонки двух сообщений)
                const activeQuestsWithName = allActiveQuestsAfterCancel.map((q) => ({
                    ...q,
                    sectorName,
                }));
                const sectorPayload = JSON.stringify({
                    type: "quest_progress",
                    quest: null,
                    sectorId: presenceEntry.sectorId,
                    sectorName: sectorName,
                    available: mobQuestInfo.available || pvpQuestInfo.available,
                    completedAt: mobQuestInfo.completedAt || pvpQuestInfo.completedAt,
                    timeUntilReset: mobQuestInfo.timeUntilReset || pvpQuestInfo.timeUntilReset,
                    questInfo: {
                        mob_kills: mobQuestInfo,
                        pvp_kills: pvpQuestInfo,
                    },
                    activeQuests: activeQuestsWithName,
                });
                for (const s of sockets) {
                    if (s.readyState === 1) {
                        try {
                            s.send(sectorPayload);
                        }
                        catch {
                            // ignore
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error("Failed to cancel quest:", err);
        }
    }
    handleRequestExit(user, socket, services) {
        const entry = services.presence.getEntry(user.id);
        if (entry) {
            const now = Date.now();
            entry.invulnerableUntil = Math.max(entry.invulnerableUntil || 0, now + constants_2.EXIT_GRACE_MS + 1000);
            services.presence.setEntry(user.id, entry);
            services.broadcast.broadcastPresence(entry.sectorId, services.presence);
            services.broadcast.sendSelfUpdate(user.id, { serverTime: now, invulnerableUntil: entry.invulnerableUntil }, services.presence);
            setTimeout(async () => {
                const current = services.presence.getEntry(user.id);
                if (current)
                    await services.player.savePlayerPosition(current, services.db);
                try {
                    socket.send(JSON.stringify({ type: "exit_ready" }));
                }
                catch {
                    // client may already be gone
                }
                socket.close(1000);
            }, constants_2.EXIT_GRACE_MS);
        }
        else {
            socket.close(1000);
        }
    }
    // player_hit is large; implemented in next chunk
    async handlePlayerHit(user, message, services) {
        const targetUserId = Number(message.targetUserId);
        if (!Number.isFinite(targetUserId) || targetUserId <= 0)
            return;
        const attacker = services.presence.getEntry(user.id);
        const victim = services.presence.getEntry(targetUserId);
        if (!attacker || !victim)
            return;
        if (attacker.isDead || victim.isDead)
            return;
        if (!attacker.sectorId || attacker.sectorId !== victim.sectorId)
            return;
        const sector = services.sectorService.sectors.get(attacker.sectorId);
        if (sector?.world.safeZone) {
            if (services.sectorService.isInsideSafeZone(sector.world.safeZone, attacker.x, attacker.y) ||
                services.sectorService.isInsideSafeZone(sector.world.safeZone, victim.x, victim.y))
                return;
        }
        const now = Date.now();
        if (victim.invulnerableUntil && victim.invulnerableUntil > now)
            return;
        const requestedDamage = Math.max(0, Number(message.damage || 0));
        const maxDamage = (0, utils_1.playerStatsForLevel)(attacker.level || 1, attacker.shipChoice).damage;
        const continuousLaser = Boolean(message.continuousLaser);
        const damageCap = continuousLaser ? maxDamage * 3 : maxDamage;
        let damage = Math.min(requestedDamage || 0, damageCap);
        if (attacker.furyExpiresAt && attacker.furyExpiresAt > now) {
            damage = Math.round(damage * constants_2.FURY_DAMAGE_MULT);
        }
        if (attacker.vengeanceTargetUserId === targetUserId && attacker.vengeanceExpiresAt && attacker.vengeanceExpiresAt > now) {
            damage = Math.round(damage * constants_2.VENGEANCE_DAMAGE_MULT);
        }
        if (!damage)
            return;
        const victimRow = await services.db.Player.findOne({
            where: { userId: targetUserId },
            attributes: ["health", "exp", "resources", "monsterProgress"],
        });
        if (!victimRow)
            return;
        const storedHealth = Number(victimRow.health);
        const currentHealth = Number.isFinite(storedHealth) ? storedHealth : Number(victim.health || 0);
        const victimInFury = victim.furyExpiresAt && victim.furyExpiresAt > now;
        const minHealth = victimInFury ? 1 : 0;
        const nextHealth = Math.max(minHealth, currentHealth - damage);
        let resources = victimRow.resources || { scrap: 0, tokens: 0 };
        const tokens = Number(resources.tokens ?? 0) || 0;
        let exp = Number(victimRow.exp ?? 0) || 0;
        const progress = victimRow.monsterProgress || {};
        const victimMonsterKey = (0, utils_1.normalizeMonsterChoice)(victim.shipChoice);
        const storedProgress = (0, utils_1.getMonsterProgressEntry)(progress, victimMonsterKey) || {};
        const nextProgress = {
            ...progress,
            [victimMonsterKey]: { ...storedProgress, exp, health: nextHealth },
        };
        let death = null;
        const diedNow = currentHealth > 0 && nextHealth === 0;
        if (diedNow) {
            const sectorGrade = sector?.grade ?? 1;
            const basePercent = (0, utils_1.randInt)(constants_2.DEATH_PENALTY_BASE_PERCENT_MIN, constants_2.DEATH_PENALTY_BASE_PERCENT_MAX);
            const sectorPercent = constants_2.PVP_DEATH_PENALTY_PERCENT_BY_GRADE[sectorGrade] ?? constants_2.PVP_DEATH_PENALTY_PERCENT_BY_GRADE[1];
            const penaltyPercent = Math.min(100, Math.floor((basePercent + sectorPercent) * constants_2.PVP_DEATH_PENALTY_EXTRA_MULT));
            const percent = Math.max(0, Math.min(100, penaltyPercent)) / 100;
            let lostTokens = Math.floor(tokens * percent);
            let lostExp = Math.floor(exp * percent);
            if (tokens > 0 && lostTokens === 0)
                lostTokens = 1;
            if (exp > 0 && lostExp === 0)
                lostExp = 1;
            resources = { ...resources, tokens: Math.max(0, tokens - lostTokens) };
            exp = Math.max(0, exp - lostExp);
            death = {
                lostTokens,
                lostExp,
                expPercent: penaltyPercent,
                tokenPercent: penaltyPercent,
                killedBy: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
                killedByUserId: user.id,
            };
            services.broadcast.broadcastToSector(attacker.sectorId, {
                type: "sector_kill_flash",
                killerName: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
                victimName: victim.nickname ?? `Пилот ${targetUserId}`,
            }, services.presence);
            try {
                const chatEntry = {
                    id: `${Date.now()}-pvp-${user.id}-${targetUserId}`,
                    userId: user.id,
                    nickname: "Система",
                    text: `${death.killedBy} убил ${victim.nickname ?? `Пилот ${targetUserId}`}.`,
                    createdAt: Date.now(),
                };
                await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
            }
            catch {
                // ignore
            }
            // Отслеживаем убийство игрока для PvP квеста убийцы
            if (attacker?.sectorId) {
                try {
                    const pvpQuestProgress = await services.quest.incrementPvpKills(user.id, attacker.sectorId);
                    if (pvpQuestProgress) {
                        // Добавляем название сектора
                        const sector = services.sectorService.sectors.get(attacker.sectorId);
                        const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : undefined;
                        const pvpQuestProgressWithName = { ...pvpQuestProgress, sectorName };
                        // Отправляем обновление прогресса PvP квеста
                        const sockets = services.presence.getSockets(user.id);
                        if (sockets) {
                            const payload = JSON.stringify({
                                type: "quest_progress",
                                quest: pvpQuestProgressWithName,
                            });
                            for (const s of sockets) {
                                if (s.readyState === 1) {
                                    try {
                                        s.send(payload);
                                    }
                                    catch {
                                        // ignore
                                    }
                                }
                            }
                        }
                        // Если PvP квест выполнен, выдаем награду и убираем флаг hasPvpQuest
                        if (pvpQuestProgress.completedAt && pvpQuestProgress.killsCompleted >= pvpQuestProgress.killsRequired) {
                            // Убираем флаг hasPvpQuest при завершении квеста
                            if (attacker.hasPvpQuest) {
                                attacker.hasPvpQuest = false;
                                services.presence.setEntry(user.id, attacker);
                                services.broadcast.broadcastPresence(attacker.sectorId, services.presence);
                            }
                            const reward = await services.quest.completeQuest(pvpQuestProgress.id, user.id, attacker.sectorId, attacker.shipChoice);
                            if (reward) {
                                // Выдаем опыт
                                if (reward.exp) {
                                    const progress = await services.player.awardPlayerExp(user.id, reward.exp, attacker.shipChoice, services.db);
                                    if (progress) {
                                        services.broadcast.sendPlayerUpdate(user.id, progress, services.presence);
                                    }
                                }
                                // Обновляем ресурсы
                                const player = await services.db.Player.findOne({
                                    where: { userId: user.id },
                                    attributes: ["resources"],
                                });
                                if (player) {
                                    services.broadcast.sendPlayerUpdate(user.id, { resources: player.resources }, services.presence);
                                }
                                // Отправляем сообщение о завершении PvP квеста
                                try {
                                    const nickname = attacker?.nickname ?? "Игрок";
                                    const sector = services.sectorService.sectors.get(attacker.sectorId || "");
                                    const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : "секторе";
                                    const chatEntry = {
                                        id: `quest-pvp-${Date.now()}-${user.id}`,
                                        userId: user.id,
                                        nickname: "Система",
                                        text: `${nickname} выполнил PvP квест в ${sectorName}! Награда: +${reward.exp} опыта, +${reward.tokens} токенов.`,
                                        createdAt: Date.now(),
                                    };
                                    await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                                    services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
                                }
                                catch {
                                    // ignore
                                }
                            }
                        }
                    }
                }
                catch (err) {
                    console.error("Failed to update PvP quest progress:", err);
                }
            }
            // Проваливаем PvP квест убитого игрока (если он был в PvP квесте)
            if (victim?.sectorId) {
                try {
                    await services.quest.failPvpQuest(targetUserId, victim.sectorId);
                    // Убираем флаг hasPvpQuest при провале квеста
                    if (victim.hasPvpQuest) {
                        victim.hasPvpQuest = false;
                        services.presence.setEntry(targetUserId, victim);
                        services.broadcast.broadcastPresence(victim.sectorId, services.presence);
                    }
                    // Отправляем сообщение о провале квеста
                    const sector = services.sectorService.sectors.get(victim.sectorId);
                    const sectorName = sector ? services.sectorService.getSectorDisplayName(sector) : "секторе";
                    const chatEntry = {
                        id: `quest-pvp-failed-${Date.now()}-${targetUserId}`,
                        userId: targetUserId,
                        nickname: "Система",
                        text: `${victim.nickname ?? `Пилот ${targetUserId}`}, PvP квест провален в ${sectorName}. Попробуйте еще раз!`,
                        createdAt: Date.now(),
                    };
                    await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                    services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
                }
                catch (err) {
                    console.error("Failed to fail PvP quest:", err);
                }
            }
            try {
                if (lostTokens > 0) {
                    const killerRow = await services.db.Player.findOne({
                        where: { userId: user.id },
                        attributes: ["resources"],
                    });
                    const rawKiller = killerRow?.resources;
                    const killerResources = {
                        scrap: Number(rawKiller?.scrap ?? 0) || 0,
                        tokens: (Number(rawKiller?.tokens ?? 0) || 0) + lostTokens,
                    };
                    await services.db.Player.update({ resources: killerResources }, { where: { userId: user.id } });
                    services.broadcast.sendPlayerUpdate(user.id, { resources: killerResources }, services.presence);
                }
                if (lostExp > 0) {
                    const progress = await services.player.awardPlayerExp(user.id, lostExp, attacker.shipChoice, services.db);
                    if (progress) {
                        services.broadcast.sendPlayerUpdate(user.id, progress, services.presence);
                        attacker.level = progress.level;
                        attacker.maxHealth = progress.maxHealth;
                        if (typeof progress.health === "number")
                            attacker.health = progress.health;
                        services.presence.setEntry(user.id, attacker);
                        if (progress.previousLevel != null && progress.level > progress.previousLevel) {
                            try {
                                const chatEntry = {
                                    id: `level-${Date.now()}-${user.id}-pvp`,
                                    userId: user.id,
                                    nickname: "Система",
                                    text: `${attacker.nickname ?? "Игрок"} достиг уровня ${progress.level}.`,
                                    createdAt: Date.now(),
                                };
                                await services.chat.persistChatMessage(chatEntry, "global", "", services.db);
                                services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.error("Failed to award PvP rewards:", err);
            }
            victim.isDead = true;
        }
        try {
            const updateResources = {
                scrap: Number(resources.scrap ?? 0) || 0,
                tokens: Number(resources.tokens ?? 0) || 0,
            };
            await services.db.Player.update({
                health: nextHealth,
                lastHealthAt: new Date(),
                exp,
                resources: updateResources,
                monsterProgress: nextProgress,
            }, { where: { userId: targetUserId } });
        }
        catch (err) {
            console.error("Failed to persist PvP damage:", err);
        }
        victim.health = nextHealth;
        victim.updatedAt = Date.now();
        if (death) {
            if (attacker.vengeanceTargetUserId === targetUserId) {
                attacker.vengeanceTargetUserId = undefined;
                attacker.vengeanceExpiresAt = undefined;
                attacker.updatedAt = Date.now();
                services.presence.setEntry(user.id, attacker);
                services.broadcast.sendSelfUpdate(user.id, { vengeance: null }, services.presence);
            }
            if (victim.huntedByUserId === user.id) {
                victim.huntedByUserId = undefined;
                victim.huntedExpiresAt = undefined;
                services.broadcast.sendSelfUpdate(targetUserId, { hunted: null }, services.presence);
            }
            else {
                victim.huntedByUserId = user.id;
                victim.huntedExpiresAt = Date.now() + constants_2.VENGEANCE_DURATION_MS;
            }
        }
        services.presence.setEntry(targetUserId, victim);
        services.broadcast.broadcastPresence(attacker.sectorId, services.presence);
        services.broadcast.sendPlayerUpdate(targetUserId, { health: nextHealth, exp, resources }, services.presence);
        services.broadcast.broadcastToSector(attacker.sectorId, {
            type: "player_shot_result",
            attackerUserId: user.id,
            victimUserId: targetUserId,
            attackerX: attacker.x,
            attackerY: attacker.y,
        }, services.presence);
        if (death) {
            services.broadcast.sendDeathUpdate(targetUserId, death, services.presence);
            if (victim.huntedByUserId != null && victim.huntedExpiresAt != null) {
                const huntedPayload = {
                    hunted: {
                        hunterUserId: victim.huntedByUserId,
                        hunterNickname: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
                        expiresAt: victim.huntedExpiresAt,
                    },
                };
                services.broadcast.sendSelfUpdate(targetUserId, huntedPayload, services.presence);
            }
        }
    }
};
exports.MessageHandlerService = MessageHandlerService;
exports.MessageHandlerService = MessageHandlerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [presence_service_1.PresenceService,
        sector_service_1.SectorService,
        broadcast_service_1.BroadcastService,
        chat_service_1.ChatService,
        player_service_1.PlayerService,
        quest_service_1.QuestService,
        db_service_1.DbService])
], MessageHandlerService);
