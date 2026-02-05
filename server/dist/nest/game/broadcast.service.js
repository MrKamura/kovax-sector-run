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
exports.BroadcastService = void 0;
const common_1 = require("@nestjs/common");
const presence_service_1 = require("./presence.service");
const sector_service_1 = require("./sector.service");
let BroadcastService = class BroadcastService {
    constructor(presence, sectorService) {
        this.presence = presence;
        this.sectorService = sectorService;
    }
    broadcastWorld(sectorId, sectorServiceOverride, presenceOverride) {
        const sec = sectorServiceOverride ?? this.sectorService;
        const pres = presenceOverride ?? this.presence;
        const sector = sec?.sectors?.get(sectorId);
        if (!sector || !pres?.clients)
            return;
        const payload = JSON.stringify({
            type: "world",
            serverTime: Date.now(),
            world: sec.getWorldSnapshot(sector),
        });
        for (const sockets of pres.clients.values()) {
            for (const socket of sockets) {
                if (socket.readyState === 1 && socket.sectorId === sectorId) {
                    socket.send(payload);
                }
            }
        }
    }
    broadcastPresence(sectorId, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        if (!pres?.presence)
            return;
        const now = Date.now();
        const players = Array.from(pres.presence.values())
            .filter((e) => e.sectorId === sectorId && pres.hasClient(e.userId))
            .map((e) => ({
            ...e,
            isHunted: !!(e.huntedByUserId != null &&
                typeof e.huntedExpiresAt === "number" &&
                e.huntedExpiresAt > now),
            huntedExpiresAt: e.huntedExpiresAt,
        }));
        const payload = JSON.stringify({
            type: "presence",
            serverTime: now,
            players,
        });
        for (const sockets of pres.clients.values()) {
            for (const socket of sockets) {
                if (socket.readyState === 1 && socket.sectorId === sectorId) {
                    socket.send(payload);
                }
            }
        }
    }
    broadcastChat(message, scope, sectorId, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        if (!pres?.clients)
            return;
        const payload = JSON.stringify({
            type: "chat_message",
            scope,
            sectorId,
            message,
        });
        for (const sockets of pres.clients.values()) {
            for (const socket of sockets) {
                if (socket.readyState !== 1)
                    continue;
                if (scope === "global") {
                    socket.send(payload);
                    continue;
                }
                const socketSectorId = socket.sectorId ?? pres.getEntry(socket.userId)?.sectorId;
                if (socketSectorId === sectorId)
                    socket.send(payload);
            }
        }
    }
    sendPrivateChat(message, senderUserId, targetUserId, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        const payload = JSON.stringify({
            type: "chat_message",
            scope: "private",
            sectorId: null,
            targetUserId,
            message,
        });
        const sendTo = (userId) => {
            const sockets = pres?.getSockets(userId);
            if (sockets) {
                for (const socket of sockets) {
                    if (socket.readyState === 1)
                        socket.send(payload);
                }
            }
        };
        sendTo(senderUserId);
        if (targetUserId !== senderUserId)
            sendTo(targetUserId);
    }
    sendPlayerUpdate(userId, player, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        const sockets = pres?.getSockets(userId);
        if (!sockets)
            return;
        const payload = JSON.stringify({ type: "player_update", player });
        for (const socket of sockets) {
            if (socket.readyState === 1)
                socket.send(payload);
        }
    }
    sendDeathUpdate(userId, death, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        const sockets = pres?.getSockets(userId);
        if (!sockets)
            return;
        const payload = JSON.stringify({ type: "death", death });
        for (const socket of sockets) {
            if (socket.readyState === 1)
                socket.send(payload);
        }
    }
    sendSelfUpdate(userId, payload, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        const sockets = pres?.getSockets(userId);
        if (!sockets)
            return;
        const message = JSON.stringify({ type: "self", ...payload });
        for (const socket of sockets) {
            if (socket.readyState === 1)
                socket.send(message);
        }
    }
    broadcastToSector(sectorId, payload, presenceOverride) {
        const pres = presenceOverride ?? this.presence;
        if (!pres?.clients)
            return;
        const p = JSON.stringify(payload);
        for (const sockets of pres.clients.values()) {
            for (const socket of sockets) {
                if (socket.readyState === 1 && socket.sectorId === sectorId) {
                    socket.send(p);
                }
            }
        }
    }
    notifyHuntersOfTargetSectorChange(targetUserId, presenceOverride, sectorServiceOverride) {
        const pres = presenceOverride ?? this.presence;
        const sec = sectorServiceOverride ?? this.sectorService;
        const targetEntry = pres?.getEntry(targetUserId);
        if (!targetEntry?.sectorId || !pres?.presence)
            return;
        const targetSector = sec?.sectors?.get(targetEntry.sectorId);
        const now = Date.now();
        for (const entry of pres.presence.values()) {
            if (entry.vengeanceTargetUserId !== targetUserId ||
                !entry.vengeanceExpiresAt ||
                entry.vengeanceExpiresAt <= now)
                continue;
            const targetEntry2 = pres.getEntry(targetUserId);
            if (!targetEntry2)
                continue;
            const targetSector2 = targetEntry2.sectorId
                ? sec?.sectors?.get(targetEntry2.sectorId)
                : null;
            this.sendSelfUpdate(entry.userId, {
                vengeance: {
                    targetUserId: entry.vengeanceTargetUserId,
                    targetNickname: targetEntry2.nickname ?? `Пилот ${targetUserId}`,
                    expiresAt: entry.vengeanceExpiresAt,
                    targetSectorId: targetEntry2.sectorId,
                    targetSectorName: targetSector2?.name ?? null,
                },
            }, pres);
        }
    }
};
exports.BroadcastService = BroadcastService;
exports.BroadcastService = BroadcastService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [presence_service_1.PresenceService,
        sector_service_1.SectorService])
], BroadcastService);
