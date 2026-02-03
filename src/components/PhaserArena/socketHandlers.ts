import type { WorldState } from "./types";

export type PresenceEntry = {
  userId: number;
  nickname: string | null;
  shipChoice: string | null;
  x: number;
  y: number;
  rotation: number;
  level?: number;
  health: number;
  maxHealth: number;
  invulnerableUntil?: number;
  isDead?: boolean;
  firingAt: number | null;
  updatedAt: number;
  huntedExpiresAt?: number;
  isHunted?: boolean;
};

/** Context required to handle presence updates (other players list). */
export interface PresencePayloadContext {
  getServerTimeOffset(): number;
  setServerTimeOffset(offset: number): void;
  linear(a: number, b: number, t: number): number;
  getSelfId(): number | undefined;
  otherPlayers: Map<
    number,
    {
      sprite: import("phaser").Physics.Arcade.Sprite;
      nameText: import("phaser").GameObjects.Text;
      healthBar: import("phaser").GameObjects.Graphics;
      lastFiringAt: number;
      huntedExpiresAt?: number;
    }
  >;
  remoteSnapshots: Map<number, unknown[]>;
  upsertRemotePlayer(entry: PresenceEntry): void;
  queueRemoteSnapshot(entry: {
    userId: number;
    nickname: string | null;
    shipChoice: string | null;
    x: number;
    y: number;
    rotation: number;
    level?: number;
    health: number;
    maxHealth: number;
    invulnerableUntil?: number;
    firingAt: number | null;
    updatedAt: number;
  }): void;
}

/** Context required to handle world updates (sector, pickups, enemies, etc.). */
export interface WorldPayloadContext {
  getServerTimeOffset(): number;
  setServerTimeOffset(offset: number): void;
  linear(a: number, b: number, t: number): number;
  applySectorInfo(sector: WorldState["sector"]): void;
  syncWorld(world: WorldState): void;
}

/** Context required to connect and maintain the socket. */
export interface ConnectSocketContext {
  setSocket(socket: WebSocket | undefined): void;
  setInvulnerableUntil(ms: number): void;
  handleSocketMessage(payload: Record<string, unknown>): void;
  getSocketShouldReconnect(): boolean;
  scheduleReconnect(fn: () => void): void;
}

export function handlePresencePayload(
  context: PresencePayloadContext,
  players: PresenceEntry[],
  serverTime?: number
): void {
  if (typeof serverTime === "number") {
    const nextOffset = serverTime - Date.now();
    context.setServerTimeOffset(
      context.linear(context.getServerTimeOffset(), nextOffset, 0.1)
    );
  }
  const selfId = context.getSelfId();
  const seen = new Set<number>();
  for (const entry of players) {
    if (selfId != null && entry.userId === selfId) {
      continue;
    }
    if (entry.isDead) {
      const remote = context.otherPlayers.get(entry.userId);
      if (remote) {
        remote.sprite.destroy();
        remote.nameText.destroy();
        remote.healthBar.destroy();
        context.otherPlayers.delete(entry.userId);
        context.remoteSnapshots.delete(entry.userId);
      }
      continue;
    }
    seen.add(entry.userId);
    context.upsertRemotePlayer(entry);
    context.queueRemoteSnapshot(entry);
  }
  for (const [userId, remote] of context.otherPlayers.entries()) {
    if (!seen.has(userId)) {
      remote.sprite.destroy();
      remote.nameText.destroy();
      remote.healthBar.destroy();
      context.otherPlayers.delete(userId);
      context.remoteSnapshots.delete(userId);
    }
  }
}

export function handleWorldPayload(
  context: WorldPayloadContext,
  world: WorldState,
  serverTime?: number
): void {
  if (typeof serverTime === "number") {
    const nextOffset = serverTime - Date.now();
    context.setServerTimeOffset(
      context.linear(context.getServerTimeOffset(), nextOffset, 0.1)
    );
  }
  context.applySectorInfo(world.sector);
  context.syncWorld(world);
}

export function sendWorldAction(
  socket: WebSocket | undefined,
  type: string,
  payload: Record<string, unknown>
): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(
    JSON.stringify({
      type,
      ...payload,
    })
  );
}

export function connectSocket(
  context: ConnectSocketContext,
  options: {
    spawnImmunityMs: number;
    getSocketUrl: () => string;
  }
): void {
  if (!context.getSocketShouldReconnect() || typeof window === "undefined") {
    return;
  }
  context.setInvulnerableUntil(options.spawnImmunityMs);
  const url = options.getSocketUrl();
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch {
    return;
  }
  context.setSocket(socket);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data as string) as Record<string, unknown>;
      context.handleSocketMessage(payload);
    } catch {
      // ignore malformed payloads
    }
  };
  socket.onclose = () => {
    if (!context.getSocketShouldReconnect()) {
      return;
    }
    context.scheduleReconnect(() => {
      connectSocket(context, options);
    });
  };
}
