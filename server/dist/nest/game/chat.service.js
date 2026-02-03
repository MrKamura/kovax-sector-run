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
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("../config/constants");
const db_service_1 = require("./db.service");
let ChatService = class ChatService {
    constructor(db) {
        this.db = db;
    }
    async loadChatHistory(scope, sectorId, db) {
        const dbService = db ?? this.db;
        if (!dbService?.pool)
            return [];
        try {
            if (scope === "global") {
                const result = await dbService.pool.query(`SELECT id, user_id, nickname, text, created_at FROM chat_messages
           WHERE scope = 'global' ORDER BY created_at DESC LIMIT $1`, [constants_1.CHAT_HISTORY_LIMIT]);
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
            if (!sectorId)
                return [];
            const result = await dbService.pool.query(`SELECT id, user_id, nickname, text, created_at FROM chat_messages
         WHERE scope = 'sector' AND sector_id = $1 ORDER BY created_at DESC LIMIT $2`, [sectorId, constants_1.CHAT_HISTORY_LIMIT]);
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
        catch (err) {
            console.error("Failed to load chat history:", err);
            return [];
        }
    }
    async persistChatMessage(message, scope, sectorId, db) {
        const dbService = db ?? this.db;
        if (!dbService?.pool)
            return;
        try {
            await dbService.pool.query(`INSERT INTO chat_messages (id, scope, sector_id, user_id, nickname, text, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`, [
                message.id,
                scope,
                scope === "global" ? null : sectorId,
                message.userId,
                message.nickname,
                message.text,
                message.createdAt,
            ]);
        }
        catch (err) {
            console.error("Failed to persist chat message:", err);
        }
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], ChatService);
