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
exports.PlayerService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("../config/constants");
const db_service_1 = require("./db.service");
const broadcast_service_1 = require("./broadcast.service");
const utils_1 = require("./utils");
let PlayerService = class PlayerService {
    constructor(db, broadcast) {
        this.db = db;
        this.broadcast = broadcast;
    }
    async savePlayerPosition(entry, dbOverride) {
        if (!entry)
            return;
        const db = dbOverride ?? this.db;
        try {
            await db.Player.update({
                posX: entry.x,
                posY: entry.y,
                rotation: entry.rotation,
                sectorId: entry.sectorId ?? null,
                lastPositionAt: new Date(),
            }, { where: { userId: entry.userId } });
        }
        catch (err) {
            console.error("Failed to persist player position:", err);
        }
    }
    startSpawnImmunityCountdownIfNeeded(entry, userId, presence) {
        if (!entry || entry.invulnerableUntil < constants_1.SPAWN_IMMUNITY_UNTIL_FIRST_ACTION)
            return;
        const now = Date.now();
        entry.invulnerableUntil = now + constants_1.SPAWN_IMMUNITY_AFTER_ACTION_MS;
        presence.setEntry(userId, entry);
        this.broadcast.sendSelfUpdate(userId, {
            serverTime: now,
            invulnerableUntil: entry.invulnerableUntil,
        });
    }
    async awardPlayerExp(userId, amount, shipChoice, dbOverride) {
        if (!amount)
            return null;
        const db = dbOverride ?? this.db;
        const monsterKey = (0, utils_1.normalizeMonsterChoice)(shipChoice);
        const player = await db.Player.findOne({ where: { userId } });
        if (!player)
            return null;
        const progress = player.monsterProgress || {};
        const stored = (0, utils_1.getMonsterProgressEntry)(progress, monsterKey);
        const previousLevel = (0, utils_1.clampLevel)(Number(stored?.level ?? player.level) || 1);
        let level = previousLevel;
        let exp = Number(stored?.exp ?? player.exp) || 0;
        let expToNext = (0, utils_1.expToNextLevel)(level);
        const MAX_PLAYER_LEVEL = 100;
        if (level < MAX_PLAYER_LEVEL) {
            exp += amount;
            while (level < MAX_PLAYER_LEVEL && exp >= expToNext) {
                exp -= expToNext;
                level = (0, utils_1.clampLevel)(level + 1);
                expToNext = (0, utils_1.expToNextLevel)(level);
            }
            if (level >= MAX_PLAYER_LEVEL) {
                level = MAX_PLAYER_LEVEL;
                exp = 0;
                expToNext = (0, utils_1.expToNextLevel)(level);
            }
        }
        else {
            level = MAX_PLAYER_LEVEL;
            exp = 0;
            expToNext = (0, utils_1.expToNextLevel)(level);
        }
        const stats = (0, utils_1.playerStatsForLevel)(level, monsterKey);
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
        let nextResources = player.resources || { scrap: 0, tokens: 0 };
        const BASE_ENERGY_CAP = 10;
        const ENERGY_CAP_PER_LEVEL = 3;
        if (leveledUp) {
            const energyCap = BASE_ENERGY_CAP + Math.max(0, level - 1) * ENERGY_CAP_PER_LEVEL;
            nextResources = {
                scrap: energyCap,
                tokens: Number(nextResources.tokens ?? 0) || 0,
            };
            await db.Player.update({
                level,
                exp,
                expToNext,
                maxHealth: stats.maxHealth,
                damage: stats.damage,
                monsterProgress: nextProgress,
                resources: nextResources,
            }, { where: { userId } });
        }
        else {
            await db.Player.update({
                level,
                exp,
                expToNext,
                maxHealth: stats.maxHealth,
                damage: stats.damage,
                monsterProgress: nextProgress,
            }, { where: { userId } });
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
    }
};
exports.PlayerService = PlayerService;
exports.PlayerService = PlayerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService,
        broadcast_service_1.BroadcastService])
], PlayerService);
