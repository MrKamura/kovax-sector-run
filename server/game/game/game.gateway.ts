import { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { GameSocket } from "./types";
import type { PresenceEntry } from "./types";
import { SPAWN_IMMUNITY_UNTIL_FIRST_ACTION } from "../config/constants";
import type { PresenceService } from "./presence.service";
import type { GameServices } from "../../container";
import {
  expToNextLevel,
  playerStatsForLevel,
  getMonsterProgressEntry,
  normalizeMonsterChoice,
} from "./utils";

function broadcastPresenceToSector(presence: PresenceService, sectorId: string): void {
  const now = Date.now();
  const players = Array.from(presence.presence.values())
    .filter((e) => e.sectorId === sectorId && presence.hasClient(e.userId))
    .map((e) => ({
      ...e,
      isHunted: !!(
        e.huntedByUserId != null &&
        typeof e.huntedExpiresAt === "number" &&
        e.huntedExpiresAt > now
      ),
      huntedExpiresAt: e.huntedExpiresAt,
    }));
  const payload = JSON.stringify({ type: "presence", serverTime: now, players });
  for (const sockets of presence.clients.values()) {
    for (const socket of sockets) {
      if (socket.readyState === 1 && socket.sectorId === sectorId) socket.send(payload);
    }
  }
}

function sendPlayerUpdateToPresence(
  presence: PresenceService,
  userId: number,
  player: Record<string, unknown>
): void {
  const sockets = presence.getSockets(userId);
  if (!sockets) return;
  const payload = JSON.stringify({ type: "player_update", player });
  for (const socket of sockets) {
    if (socket.readyState === 1) socket.send(payload);
  }
}

export class GameGateway {
  private wss: InstanceType<typeof WebSocketServer> | null = null;
  private services: GameServices | null = null;

  /** Attach the game WebSocket to the HTTP server. `services` is built once by the container (see server/container.ts). */
  attachToServer(
    server: import("http").Server,
    services: GameServices,
    nextUpgradeHandler?: (req: IncomingMessage, socket: import("net").Socket, head: Buffer) => Promise<void>
  ): void {
    this.services = services;
    this.wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request: IncomingMessage, socket: import("net").Socket, head: Buffer) => {
      if (request.url?.startsWith("/ws")) {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit("connection", ws, request);
        });
      } else if (nextUpgradeHandler) {
        nextUpgradeHandler(request, socket, head).catch(() => {
          try {
            socket.destroy();
          } catch {
            // ignore
          }
        });
      }
    });
    this.wss.on("connection", (ws: GameSocket, request: IncomingMessage) => {
      void this.handleConnection(ws, request);
    });
  }

  private async handleConnection(ws: GameSocket, request: IncomingMessage): Promise<void> {
    if (!this.services) {
      ws.close(1011, "Server not ready");
      return;
    }
    const db = this.services.db;
    const presence = this.services.presence;
    const sectorService = this.services.sectorService;
    const chat = this.services.chat;
    const messageHandler = this.services.messageHandler;
    const player = this.services.player;
    const quest = this.services.quest;

    const cookieHeader = request.headers.cookie || "";
    const cookies = db.parseCookies(cookieHeader);
    const user = await db.resolveUser(cookies.session);
    if (!user) {
      ws.close(1008, "Unauthorized");
      return;
    }

    presence.addClient(user.id, ws);
    const existingPresence = presence.getEntry(user.id);

    let posX = existingPresence?.x ?? 0;
    let posY = existingPresence?.y ?? 0;
    let rotation = existingPresence?.rotation ?? 0;
    let health = existingPresence?.health ?? 100;
    let maxHealth = existingPresence?.maxHealth ?? 100;
    let level = existingPresence?.level ?? 1;
    let exp = 0;
    let expToNext = expToNextLevel(level);
    let damage = 12;
    const shouldSendPlayerUpdate = !existingPresence;

    let savedSectorId: string | null = null;
    if (!existingPresence) {
      try {
        const playerRow = await db.Player.findOne({
          where: { userId: user.id },
          attributes: ["posX", "posY", "rotation", "sectorId", "health", "maxHealth", "level", "exp", "expToNext", "damage", "monsterProgress"],
        });
        if (playerRow) {
          const row = playerRow.get() as {
            posX?: unknown;
            posY?: unknown;
            rotation?: unknown;
            sectorId?: string | null;
            health?: unknown;
            maxHealth?: unknown;
            level?: unknown;
            exp?: unknown;
            expToNext?: unknown;
            damage?: unknown;
            monsterProgress?: unknown;
          };
          posX = Number(row.posX) || 0;
          posY = Number(row.posY) || 0;
          rotation = Number(row.rotation) || 0;
          savedSectorId = row.sectorId ?? null;
          const monsterKey = normalizeMonsterChoice(user.shipChoice);
          const progress = (row.monsterProgress as Record<string, unknown>) || {};
          const stored = getMonsterProgressEntry(progress, monsterKey);
          if (stored) {
            level = Number(stored.level) || 1;
            exp = Number(stored.exp) || 0;
            expToNext = Number(stored.expToNext) || expToNextLevel(level);
            maxHealth = Number(stored.maxHealth) ?? playerStatsForLevel(level, monsterKey).maxHealth;
            damage = Number(stored.damage) ?? playerStatsForLevel(level, monsterKey).damage;
            health = Number(stored.health) || maxHealth;
          } else {
            level = Number(row.level) || 1;
            exp = Number(row.exp) || 0;
            expToNext = Number(row.expToNext) || expToNextLevel(level);
            const stats = playerStatsForLevel(level, user.shipChoice);
            maxHealth = Number(row.maxHealth) || stats.maxHealth;
            damage = Number(row.damage) || stats.damage;
            health = Number(row.health) || maxHealth;
          }
        }
      } catch (err) {
        console.error("Failed to load player position:", err);
      }
    }

    // Новые игроки (уровень 1) всегда появляются в белом секторе L1-01
    const whiteSector = sectorService.getSectorByLevelAndGrade(1, 1);
    const assignedSector =
      existingPresence && sectorService.sectors.has(existingPresence.sectorId)
        ? sectorService.sectors.get(existingPresence.sectorId)!
        : level === 1
          ? (whiteSector ?? sectorService.findOrCreateSector(1, undefined, presence))
          : savedSectorId && sectorService.sectors.has(savedSectorId)
            ? sectorService.sectors.get(savedSectorId)!
            : (whiteSector ?? sectorService.findOrCreateSector(1, undefined, presence));

    (ws as GameSocket).userId = user.id;
    (ws as GameSocket).sectorId = assignedSector.id;
    (ws as GameSocket).user = user;

    if (existingPresence) {
      const stats = playerStatsForLevel(level, existingPresence.shipChoice);
      maxHealth = maxHealth || stats.maxHealth;
      damage = stats.damage;
    }

    const invulnerableUntil = existingPresence
      ? (existingPresence.invulnerableUntil ?? 0)
      : SPAWN_IMMUNITY_UNTIL_FIRST_ACTION;

    const boundedX = Math.min(
      assignedSector.config.width - 120,
      Math.max(120, posX)
    );
    const boundedY = Math.min(
      assignedSector.config.height - 120,
      Math.max(120, posY)
    );
    const zone = assignedSector.world.safeZone;
    const initialInSafeZone =
      zone &&
      zone.expiresAt > Date.now() &&
      sectorService.isInsideSafeZone(zone, boundedX, boundedY);

    // Проверяем, есть ли активный PvP квест
    let hasPvpQuest = false;
    try {
      const allActiveQuests = await quest.getAllActiveQuests(user.id, assignedSector.id);
      hasPvpQuest = allActiveQuests.some(q => q.questType === "pvp_kills");
    } catch {
      // ignore
    }

    const entry: PresenceEntry = {
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
      hasPvpQuest,
      vengeanceTargetUserId: existingPresence?.vengeanceTargetUserId,
      vengeanceExpiresAt: existingPresence?.vengeanceExpiresAt,
      huntedByUserId: existingPresence?.huntedByUserId,
      huntedExpiresAt: existingPresence?.huntedExpiresAt,
    };
    presence.setEntry(user.id, entry);
    broadcastPresenceToSector(presence, assignedSector.id);

    ws.send(
      JSON.stringify({
        type: "world",
        serverTime: Date.now(),
        world: sectorService.getWorldSnapshot(assignedSector),
      })
    );

    const now = Date.now();
    const selfPayload: Record<string, unknown> = {
      type: "self",
      serverTime: now,
      invulnerableUntil,
    };
    if (existingPresence) {
      selfPayload.posX = entry.x;
      selfPayload.posY = entry.y;
      selfPayload.sectorId = entry.sectorId;
    }
    if (
      entry.vengeanceExpiresAt &&
      entry.vengeanceTargetUserId &&
      entry.vengeanceExpiresAt > now
    ) {
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
    if (
      entry.huntedExpiresAt &&
      entry.huntedByUserId &&
      entry.huntedExpiresAt > now
    ) {
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
    ws.send(
      JSON.stringify({
        type: "chat_history",
        scope: "sector",
        sectorId: assignedSector.id,
        messages: await chat.loadChatHistory("sector", assignedSector.id, db),
      })
    );
    ws.send(
      JSON.stringify({
        type: "chat_history",
        scope: "global",
        messages: await chat.loadChatHistory("global", undefined, db),
      })
    );

    // Проверяем информацию о квестах для сектора
    try {
      const allActiveQuests = await quest.getAllActiveQuests(user.id, assignedSector.id);
      const sectorName = sectorService.getSectorDisplayName(assignedSector);
      
      if (allActiveQuests.length > 0) {
        // Отправляем все активные квесты
        for (const activeQuest of allActiveQuests) {
          const questWithName = { ...activeQuest, sectorName };
          ws.send(JSON.stringify({ 
            type: "quest_progress", 
            quest: questWithName,
            sectorId: assignedSector.id,
            sectorName: sectorName,
            available: true,
          }));
        }
      } else {
        // Если активных квестов нет, отправляем информацию о секторе
        const questInfo = await quest.getQuestInfo(user.id, assignedSector.id);
        ws.send(JSON.stringify({
          type: "quest_progress",
          quest: null,
          available: questInfo.available,
          sectorId: assignedSector.id,
          sectorName: sectorName,
          completedAt: questInfo.completedAt,
          timeUntilReset: questInfo.timeUntilReset,
        }));
      }
    } catch (err) {
      console.error("Failed to load quests:", err);
    }

    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as Record<string, unknown>;
        await messageHandler.handle(user, message, ws as GameSocket);
      } catch {
        // ignore invalid messages
      }
    });

    ws.on("close", () => {
      const removed = presence.removeClient(user.id, ws as GameSocket);
      if (removed) {
        const last = presence.getEntry(user.id);
        void player.savePlayerPosition(last, db);
        if (last?.sectorId) {
          broadcastPresenceToSector(presence, last.sectorId);
        }
      }
    });
  }
}
