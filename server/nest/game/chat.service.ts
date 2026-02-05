import { Injectable } from "@nestjs/common";
import { CHAT_HISTORY_LIMIT } from "../config/constants";
import type { ChatMessage } from "./types";
import { DbService } from "./db.service";

@Injectable()
export class ChatService {
  constructor(private readonly db: DbService) {}

  async loadChatHistory(
    scope: "global" | "sector" | "private",
    sectorId?: string,
    db?: DbService,
    myUserId?: number,
    targetUserId?: number
  ): Promise<ChatMessage[]> {
    const dbService = db ?? this.db;
    try {
      if (scope === "global") {
        const rows = await dbService.ChatMessage.findAll({
          where: { scope: "global" },
          order: [["createdAt", "DESC"]],
          limit: CHAT_HISTORY_LIMIT,
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
        const { Op } = await import("sequelize");
        const rows = await dbService.ChatMessage.findAll({
          where: {
            scope: "private",
            [Op.or]: [
              { userId: myUserId, targetUserId },
              { userId: targetUserId, targetUserId: myUserId },
            ],
          },
          order: [["createdAt", "ASC"]],
          limit: CHAT_HISTORY_LIMIT,
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
      if (!sectorId) return [];
      const rows = await dbService.ChatMessage.findAll({
        where: { scope: "sector", sectorId },
        order: [["createdAt", "DESC"]],
        limit: CHAT_HISTORY_LIMIT,
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
    } catch (err) {
      console.error("Failed to load chat history:", err);
      return [];
    }
  }

  async persistChatMessage(
    message: ChatMessage & { id: string },
    scope: string,
    sectorId: string,
    db?: DbService,
    targetUserId?: number | null
  ): Promise<void> {
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
    } catch (err) {
      console.error("Failed to persist chat message:", err);
    }
  }
}
