import type { GameSocket } from "./types";
import { PresenceService } from "./presence.service";
import { SectorService } from "./sector.service";

export class BroadcastService {
  constructor(
    private readonly presence: PresenceService,
    private readonly sectorService: SectorService
  ) {}

  broadcastWorld(
    sectorId: string,
    sectorServiceOverride?: SectorService,
    presenceOverride?: PresenceService
  ): void {
    const sec = sectorServiceOverride ?? this.sectorService;
    const pres = presenceOverride ?? this.presence;
    const sector = sec?.sectors?.get(sectorId);
    if (!sector || !pres?.clients) return;
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

  broadcastPresence(sectorId: string, presenceOverride?: PresenceService): void {
    const pres = presenceOverride ?? this.presence;
    if (!pres?.presence) return;
    const now = Date.now();
    const players = Array.from(pres.presence.values())
      .filter((e) => e.sectorId === sectorId && pres.hasClient(e.userId))
      .map((e) => ({
        ...e,
        isHunted: !!(
          e.huntedByUserId != null &&
          typeof e.huntedExpiresAt === "number" &&
          e.huntedExpiresAt > now
        ),
        huntedExpiresAt: e.huntedExpiresAt,
        hasPvpQuest: e.hasPvpQuest ?? false,
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

  broadcastChat(
    message: { id: string; userId: number; nickname: string; text: string; createdAt: number; targetUserId?: number | null },
    scope: string,
    sectorId: string,
    presenceOverride?: PresenceService
  ): void {
    const pres = presenceOverride ?? this.presence;
    if (!pres?.clients) return;
    const payload = JSON.stringify({
      type: "chat_message",
      scope,
      sectorId,
      message,
    });
    for (const sockets of pres.clients.values()) {
      for (const socket of sockets) {
        if (socket.readyState !== 1) continue;
        if (scope === "global") {
          socket.send(payload);
          continue;
        }
        const socketSectorId = socket.sectorId ?? pres.getEntry((socket as GameSocket).userId!)?.sectorId;
        if (socketSectorId === sectorId) socket.send(payload);
      }
    }
  }

  sendPrivateChat(
    message: { id: string; userId: number; nickname: string; text: string; createdAt: number; targetUserId?: number | null },
    senderUserId: number,
    targetUserId: number,
    presenceOverride?: PresenceService
  ): void {
    const pres = presenceOverride ?? this.presence;
    const payload = JSON.stringify({
      type: "chat_message",
      scope: "private",
      sectorId: null,
      targetUserId,
      message,
    });
    const sendTo = (userId: number) => {
      const sockets = pres?.getSockets(userId);
      if (sockets) {
        for (const socket of sockets) {
          if (socket.readyState === 1) socket.send(payload);
        }
      }
    };
    sendTo(senderUserId);
    if (targetUserId !== senderUserId) sendTo(targetUserId);
  }

  sendPlayerUpdate(userId: number, player: Record<string, unknown>, presenceOverride?: PresenceService): void {
    const pres = presenceOverride ?? this.presence;
    const sockets = pres?.getSockets(userId);
    if (!sockets) return;
    const payload = JSON.stringify({ type: "player_update", player });
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(payload);
    }
  }

  sendDeathUpdate(userId: number, death: Record<string, unknown>, presenceOverride?: PresenceService): void {
    const pres = presenceOverride ?? this.presence;
    const sockets = pres?.getSockets(userId);
    if (!sockets) return;
    const payload = JSON.stringify({ type: "death", death });
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(payload);
    }
  }

  sendSelfUpdate(userId: number, payload: Record<string, unknown>, presenceOverride?: PresenceService): void {
    const pres = presenceOverride ?? this.presence;
    const sockets = pres?.getSockets(userId);
    if (!sockets) return;
    const message = JSON.stringify({ type: "self", ...payload });
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(message);
    }
  }

  broadcastToSector(sectorId: string, payload: Record<string, unknown>, presenceOverride?: PresenceService): void {
    const pres = presenceOverride ?? this.presence;
    if (!pres?.clients) return;
    const p = JSON.stringify(payload);
    for (const sockets of pres.clients.values()) {
      for (const socket of sockets) {
        if (socket.readyState === 1 && socket.sectorId === sectorId) {
          socket.send(p);
        }
      }
    }
  }

  notifyHuntersOfTargetSectorChange(
    targetUserId: number,
    presenceOverride?: PresenceService,
    sectorServiceOverride?: SectorService
  ): void {
    const pres = presenceOverride ?? this.presence;
    const sec = sectorServiceOverride ?? this.sectorService;
    const targetEntry = pres?.getEntry(targetUserId);
    if (!targetEntry?.sectorId || !pres?.presence) return;
    const targetSector = sec?.sectors?.get(targetEntry.sectorId);
    const now = Date.now();
    for (const entry of pres.presence.values()) {
      if (
        entry.vengeanceTargetUserId !== targetUserId ||
        !entry.vengeanceExpiresAt ||
        entry.vengeanceExpiresAt <= now
      )
        continue;
      const targetEntry2 = pres.getEntry(targetUserId);
      if (!targetEntry2) continue;
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
}
