import { Injectable } from "@nestjs/common";
import { CHAT_HISTORY_LIMIT } from "../config/constants";
import type { ChatMessage } from "./types";
import { DbService } from "./db.service";

@Injectable()
export class ChatService {
  constructor(private readonly db: DbService) {}

  async loadChatHistory(
    scope: "global" | "sector",
    sectorId?: string,
    db?: DbService
  ): Promise<ChatMessage[]> {
    const dbService = db ?? this.db;
    if (!dbService?.pool) return [];
    try {
      if (scope === "global") {
        const result = await dbService.pool.query(
          `SELECT id, user_id, nickname, text, created_at FROM chat_messages
           WHERE scope = 'global' ORDER BY created_at DESC LIMIT $1`,
          [CHAT_HISTORY_LIMIT]
        );
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
      if (!sectorId) return [];
      const result = await dbService.pool.query(
        `SELECT id, user_id, nickname, text, created_at FROM chat_messages
         WHERE scope = 'sector' AND sector_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [sectorId, CHAT_HISTORY_LIMIT]
      );
      return result.rows
        .map((row) => ({
          id: String(row.id),
          userId: Number(row.user_id),
          nickname: String(row.nickname),
          text: String(row.text),
          createdAt: Number(row.created_at),
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
    db?: DbService
  ): Promise<void> {
    const dbService = db ?? this.db;
    if (!dbService?.pool) return;
    try {
      await dbService.pool.query(
        `INSERT INTO chat_messages (id, scope, sector_id, user_id, nickname, text, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [
          message.id,
          scope,
          scope === "global" ? null : sectorId,
          message.userId,
          message.nickname,
          message.text,
          message.createdAt,
        ]
      );
    } catch (err) {
      console.error("Failed to persist chat message:", err);
    }
  }
}
