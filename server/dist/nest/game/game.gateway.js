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
exports.GameGateway = void 0;
const common_1 = require("@nestjs/common");
const ws_1 = require("ws");
const constants_1 = require("../config/constants");
const db_service_1 = require("./db.service");
const presence_service_1 = require("./presence.service");
const sector_service_1 = require("./sector.service");
const broadcast_service_1 = require("./broadcast.service");
const chat_service_1 = require("./chat.service");
const message_handler_service_1 = require("./message-handler.service");
const player_service_1 = require("./player.service");
const utils_1 = require("./utils");
function broadcastPresenceToSector(presence, sectorId) {
    const now = Date.now();
    const players = Array.from(presence.presence.values())
        .filter((e) => e.sectorId === sectorId && presence.hasClient(e.userId))
        .map((e) => ({
        ...e,
        isHunted: !!(e.huntedByUserId != null &&
            typeof e.huntedExpiresAt === "number" &&
            e.huntedExpiresAt > now),
        huntedExpiresAt: e.huntedExpiresAt,
    }));
    const payload = JSON.stringify({ type: "presence", serverTime: now, players });
    for (const sockets of presence.clients.values()) {
        for (const socket of sockets) {
            if (socket.readyState === 1 && socket.sectorId === sectorId)
                socket.send(payload);
        }
    }
}
function sendPlayerUpdateToPresence(presence, userId, player) {
    const sockets = presence.getSockets(userId);
    if (!sockets)
        return;
    const payload = JSON.stringify({ type: "player_update", player });
    for (const socket of sockets) {
        if (socket.readyState === 1)
            socket.send(payload);
    }
}
let GameGateway = class GameGateway {
    constructor(db, presence, sectorService, broadcast, chat, messageHandler, player) {
        this.db = db;
        this.presence = presence;
        this.sectorService = sectorService;
        this.broadcast = broadcast;
        this.chat = chat;
        this.messageHandler = messageHandler;
        this.player = player;
        this.wss = null;
        this.resolved = null;
    }
    /** When using createApplicationContext, Nest may not inject deps; pass resolved services from bootstrap. */
    attachToServer(server, nextUpgradeHandler, resolved) {
        this.resolved = resolved ?? null;
        this.wss = new ws_1.WebSocketServer({ noServer: true });
        server.on("upgrade", (request, socket, head) => {
            if (request.url?.startsWith("/ws")) {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit("connection", ws, request);
                });
            }
            else if (nextUpgradeHandler) {
                nextUpgradeHandler(request, socket, head).catch(() => {
                    try {
                        socket.destroy();
                    }
                    catch {
                        // ignore
                    }
                });
            }
        });
        this.wss.on("connection", (ws, request) => {
            void this.handleConnection(ws, request);
        });
    }
    async handleConnection(ws, request) {
        const db = this.resolved?.db ?? this.db;
        const presence = this.resolved?.presence ?? this.presence;
        const sectorService = this.resolved?.sectorService ?? this.sectorService;
        const chat = this.resolved?.chat ?? this.chat;
        const messageHandler = this.resolved?.messageHandler ?? this.messageHandler;
        const player = this.resolved?.player ?? this.player;
        if (!db) {
            ws.close(1008, "Unauthorized");
            return;
        }
        const cookieHeader = request.headers.cookie || "";
        const cookies = db.parseCookies(cookieHeader);
        const user = await db.resolveUser(cookies.session);
        if (!user) {
            ws.close(1008, "Unauthorized");
            return;
        }
        presence.addClient(user.id, ws);
        const existingPresence = presence.getEntry(user.id);
        const assignedSector = existingPresence && sectorService.sectors.has(existingPresence.sectorId)
            ? sectorService.sectors.get(existingPresence.sectorId)
            : sectorService.findOrCreateSector(1, undefined, presence);
        ws.userId = user.id;
        ws.sectorId = assignedSector.id;
        ws.user = user;
        let posX = existingPresence?.x ?? 0;
        let posY = existingPresence?.y ?? 0;
        let rotation = existingPresence?.rotation ?? 0;
        let health = existingPresence?.health ?? 100;
        let maxHealth = existingPresence?.maxHealth ?? 100;
        let level = existingPresence?.level ?? 1;
        let exp = 0;
        let expToNext = (0, utils_1.expToNextLevel)(level);
        let damage = 12;
        const shouldSendPlayerUpdate = !existingPresence;
        if (!existingPresence) {
            try {
                const playerRow = await db.pool.query(`SELECT "posX", "posY", "rotation", "health", "maxHealth", "level", "exp", "expToNext", "damage", "monsterProgress" FROM players WHERE "userId" = $1`, [user.id]);
                if (playerRow.rowCount && playerRow.rowCount > 0) {
                    const row = playerRow.rows[0];
                    posX = Number(row.posX) || 0;
                    posY = Number(row.posY) || 0;
                    rotation = Number(row.rotation) || 0;
                    const monsterKey = (0, utils_1.normalizeMonsterChoice)(user.shipChoice);
                    const progress = row.monsterProgress || {};
                    const stored = (0, utils_1.getMonsterProgressEntry)(progress, monsterKey);
                    if (stored) {
                        level = Number(stored.level) || 1;
                        exp = Number(stored.exp) || 0;
                        expToNext = Number(stored.expToNext) || (0, utils_1.expToNextLevel)(level);
                        maxHealth = Number(stored.maxHealth) || (0, utils_1.playerStatsForLevel)(level, monsterKey).maxHealth;
                        damage = Number(stored.damage) || (0, utils_1.playerStatsForLevel)(level, monsterKey).damage;
                        health = Number(stored.health) || maxHealth;
                    }
                    else {
                        level = Number(row.level) || 1;
                        exp = Number(row.exp) || 0;
                        expToNext = Number(row.expToNext) || (0, utils_1.expToNextLevel)(level);
                        const stats = (0, utils_1.playerStatsForLevel)(level, user.shipChoice);
                        maxHealth = Number(row.maxHealth) || stats.maxHealth;
                        damage = Number(row.damage) || stats.damage;
                        health = Number(row.health) || maxHealth;
                    }
                }
            }
            catch (err) {
                console.error("Failed to load player position:", err);
            }
        }
        else {
            const stats = (0, utils_1.playerStatsForLevel)(level, existingPresence.shipChoice);
            maxHealth = maxHealth || stats.maxHealth;
            damage = stats.damage;
        }
        const invulnerableUntil = existingPresence
            ? (existingPresence.invulnerableUntil ?? 0)
            : constants_1.SPAWN_IMMUNITY_UNTIL_FIRST_ACTION;
        const boundedX = Math.min(assignedSector.config.width - 120, Math.max(120, posX));
        const boundedY = Math.min(assignedSector.config.height - 120, Math.max(120, posY));
        const zone = assignedSector.world.safeZone;
        const initialInSafeZone = zone &&
            zone.expiresAt > Date.now() &&
            sectorService.isInsideSafeZone(zone, boundedX, boundedY);
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
            wasInSafeZone: !!initialInSafeZone,
            vengeanceTargetUserId: existingPresence?.vengeanceTargetUserId,
            vengeanceExpiresAt: existingPresence?.vengeanceExpiresAt,
            huntedByUserId: existingPresence?.huntedByUserId,
            huntedExpiresAt: existingPresence?.huntedExpiresAt,
        };
        presence.setEntry(user.id, entry);
        broadcastPresenceToSector(presence, assignedSector.id);
        ws.send(JSON.stringify({
            type: "world",
            serverTime: Date.now(),
            world: sectorService.getWorldSnapshot(assignedSector),
        }));
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
        if (entry.vengeanceExpiresAt &&
            entry.vengeanceTargetUserId &&
            entry.vengeanceExpiresAt > now) {
            const targetEntry = presence.getEntry(entry.vengeanceTargetUserId);
            const targetSector = targetEntry?.sectorId
                ? sectorService.sectors.get(targetEntry.sectorId)
                : null;
            selfPayload.vengeance = {
                targetUserId: entry.vengeanceTargetUserId,
                targetNickname: targetEntry?.nickname ?? `Пилот ${entry.vengeanceTargetUserId}`,
                expiresAt: entry.vengeanceExpiresAt,
                targetSectorId: targetEntry?.sectorId ?? null,
                targetSectorName: targetSector?.name ?? null,
            };
        }
        if (entry.huntedExpiresAt &&
            entry.huntedByUserId &&
            entry.huntedExpiresAt > now) {
            const hunterEntry = presence.getEntry(entry.huntedByUserId);
            selfPayload.hunted = {
                hunterUserId: entry.huntedByUserId,
                hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
                expiresAt: entry.huntedExpiresAt,
            };
        }
        ws.send(JSON.stringify(selfPayload));
        if (shouldSendPlayerUpdate) {
            sendPlayerUpdateToPresence(presence, user.id, {
                level,
                exp,
                expToNext,
                maxHealth,
                damage,
            });
        }
        ws.send(JSON.stringify({
            type: "chat_history",
            scope: "sector",
            sectorId: assignedSector.id,
            messages: await chat.loadChatHistory("sector", assignedSector.id, db),
        }));
        ws.send(JSON.stringify({
            type: "chat_history",
            scope: "global",
            messages: await chat.loadChatHistory("global", undefined, db),
        }));
        ws.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await messageHandler.handle(user, message, ws, this.resolved ?? undefined);
            }
            catch {
                // ignore invalid messages
            }
        });
        ws.on("close", () => {
            const removed = presence.removeClient(user.id, ws);
            if (removed) {
                const last = presence.getEntry(user.id);
                void player.savePlayerPosition(last, db);
                if (last?.sectorId) {
                    broadcastPresenceToSector(presence, last.sectorId);
                }
            }
        });
    }
};
exports.GameGateway = GameGateway;
exports.GameGateway = GameGateway = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService,
        presence_service_1.PresenceService,
        sector_service_1.SectorService,
        broadcast_service_1.BroadcastService,
        chat_service_1.ChatService,
        message_handler_service_1.MessageHandlerService,
        player_service_1.PlayerService])
], GameGateway);
