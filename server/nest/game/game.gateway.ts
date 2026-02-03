import { Injectable } from "@nestjs/common";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { GameSocket } from "./types";
import type { PresenceEntry } from "./types";
import { SPAWN_IMMUNITY_UNTIL_FIRST_ACTION } from "../config/constants";
import { DbService } from "./db.service";
import { PresenceService } from "./presence.service";
import { SectorService } from "./sector.service";
import { BroadcastService } from "./broadcast.service";
import { ChatService } from "./chat.service";
import { MessageHandlerService } from "./message-handler.service";
import { PlayerService } from "./player.service";
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

export interface GatewayResolvedServices {
  db: DbService;
  presence: PresenceService;
  sectorService: SectorService;
  broadcast: BroadcastService;
  chat: ChatService;
  messageHandler: MessageHandlerService;
  player: PlayerService;
}

@Injectable()
export class GameGateway {
  private wss: InstanceType<typeof WebSocketServer> | null = null;
  private resolved: GatewayResolvedServices | null = null;

  constructor(
    private readonly db: DbService,
    private readonly presence: PresenceService,
    private readonly sectorService: SectorService,
    private readonly broadcast: BroadcastService,
    private readonly chat: ChatService,
    private readonly messageHandler: MessageHandlerService,
    private readonly player: PlayerService
  ) {}

  /** When using createApplicationContext, Nest may not inject deps; pass resolved services from bootstrap. */
  attachToServer(
    server: import("http").Server,
    nextUpgradeHandler?: (req: IncomingMessage, socket: import("net").Socket, head: Buffer) => Promise<void>,
    resolved?: GatewayResolvedServices
  ): void {
    this.resolved = resolved ?? null;
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
    const assignedSector =
      existingPresence && sectorService.sectors.has(existingPresence.sectorId)
        ? sectorService.sectors.get(existingPresence.sectorId)!
        : sectorService.findOrCreateSector(1, undefined, presence);

    (ws as GameSocket).userId = user.id;
    (ws as GameSocket).sectorId = assignedSector.id;
    (ws as GameSocket).user = user;

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

    if (!existingPresence) {
      try {
        const playerRow = await db.pool.query(
          `SELECT "posX", "posY", "rotation", "health", "maxHealth", "level", "exp", "expToNext", "damage", "monsterProgress" FROM players WHERE "userId" = $1`,
          [user.id]
        );
        if (playerRow.rowCount && playerRow.rowCount > 0) {
          const row = playerRow.rows[0];
          posX = Number(row.posX) || 0;
          posY = Number(row.posY) || 0;
          rotation = Number(row.rotation) || 0;
          const monsterKey = normalizeMonsterChoice(user.shipChoice);
          const progress = row.monsterProgress || {};
          const stored = getMonsterProgressEntry(progress, monsterKey);
          if (stored) {
            level = Number(stored.level) || 1;
            exp = Number(stored.exp) || 0;
            expToNext = Number(stored.expToNext) || expToNextLevel(level);
            maxHealth = Number(stored.maxHealth) || playerStatsForLevel(level, monsterKey).maxHealth;
            damage = Number(stored.damage) || playerStatsForLevel(level, monsterKey).damage;
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
    } else {
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

    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as Record<string, unknown>;
        await messageHandler.handle(user, message, ws as GameSocket, this.resolved ?? undefined);
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
