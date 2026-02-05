"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    async loadChatHistory(scope, sectorId, db, myUserId, targetUserId) {
        const dbService = db ?? this.db;
        try {
            if (scope === "global") {
                const rows = await dbService.ChatMessage.findAll({
                    where: { scope: "global" },
                    order: [["createdAt", "DESC"]],
                    limit: constants_1.CHAT_HISTORY_LIMIT,
                    attributes: ["id", "userId", "nickname", "text", "createdAt"],
                });
                return rows
                    .map((row) => ({
                    id: String(row.id),
                    userId: Number(row.userId),
                    nickname: String(row.nickname),
                    text: String(row.text),
                    createdAt: Number(row.createdAt),
                }))
                    .reverse();
            }
            if (scope === "private" && myUserId != null && targetUserId != null) {
                const { Op } = await Promise.resolve().then(() => __importStar(require("sequelize")));
                const rows = await dbService.ChatMessage.findAll({
                    where: {
                        scope: "private",
                        [Op.or]: [
                            { userId: myUserId, targetUserId },
                            { userId: targetUserId, targetUserId: myUserId },
                        ],
                    },
                    order: [["createdAt", "ASC"]],
                    limit: constants_1.CHAT_HISTORY_LIMIT,
                    attributes: ["id", "userId", "nickname", "text", "createdAt", "targetUserId"],
                });
                return rows.map((row) => ({
                    id: String(row.id),
                    userId: Number(row.userId),
                    nickname: String(row.nickname),
                    text: String(row.text),
                    createdAt: Number(row.createdAt),
                    targetUserId: row.targetUserId != null ? Number(row.targetUserId) : null,
                }));
            }
            if (!sectorId)
                return [];
            const rows = await dbService.ChatMessage.findAll({
                where: { scope: "sector", sectorId },
                order: [["createdAt", "DESC"]],
                limit: constants_1.CHAT_HISTORY_LIMIT,
                attributes: ["id", "userId", "nickname", "text", "createdAt"],
            });
            return rows
                .map((row) => ({
                id: String(row.id),
                userId: Number(row.userId),
                nickname: String(row.nickname),
                text: String(row.text),
                createdAt: Number(row.createdAt),
            }))
                .reverse();
        }
        catch (err) {
            console.error("Failed to load chat history:", err);
            return [];
        }
    }
    async persistChatMessage(message, scope, sectorId, db, targetUserId) {
        const dbService = db ?? this.db;
        try {
            await dbService.ChatMessage.findOrCreate({
                where: { id: message.id },
                defaults: {
                    id: message.id,
                    scope,
                    sectorId: scope === "global" ? null : sectorId,
                    targetUserId: scope === "private" ? targetUserId ?? null : null,
                    userId: message.userId,
                    nickname: message.nickname,
                    text: message.text,
                    createdAt: message.createdAt,
                },
            });
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
