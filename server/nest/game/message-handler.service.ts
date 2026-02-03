import { Injectable } from "@nestjs/common";
import type { GameSocket } from "./types";
import type { PresenceEntry } from "./types";
import type { ResolvedUser } from "./db.service";
import type { GatewayResolvedServices } from "./game.gateway";
import { PresenceService } from "./presence.service";
import { SectorService } from "./sector.service";
import { BroadcastService } from "./broadcast.service";
import { ChatService } from "./chat.service";
import { PlayerService } from "./player.service";
import { DbService } from "./db.service";
import { SPAWN_IMMUNITY_UNTIL_FIRST_ACTION, SPAWN_IMMUNITY_AFTER_ACTION_MS } from "../config/constants";
import {
  randBetween,
  randInt,
  expToNextLevel,
  playerStatsForLevel,
  getMonsterProgressEntry,
  normalizeMonsterChoice,
  energyCapForLevel,
  tokensForMobLevel,
} from "./utils";
import {
  VENGEANCE_DURATION_MS,
  VENGEANCE_DAMAGE_MULT,
  FURY_DAMAGE_MULT,
  GRAVITY_PIT_RADIUS,
  GRAVITY_PIT_DURATION_MS,
  ENEMY_RESPAWN_MS,
  PICKUP_RESPAWN_MS,
  EXIT_GRACE_MS,
} from "../config/constants";
import type { Sector } from "./types";

export interface HandlerServices {
  presence: PresenceService;
  sectorService: SectorService;
  broadcast: BroadcastService;
  chat: ChatService;
  player: PlayerService;
  db: DbService;
}

function startSpawnImmunityIfNeeded(
  entry: PresenceEntry | undefined,
  userId: number,
  services: HandlerServices
): void {
  if (!entry || entry.invulnerableUntil < SPAWN_IMMUNITY_UNTIL_FIRST_ACTION) return;
  const now = Date.now();
  entry.invulnerableUntil = now + SPAWN_IMMUNITY_AFTER_ACTION_MS;
  services.presence.setEntry(userId, entry);
  services.broadcast.sendSelfUpdate(userId, { serverTime: now, invulnerableUntil: entry.invulnerableUntil }, services.presence);
}

/**
 * Handles all WebSocket message types from the game client.
 * Ported from server/index.js – each branch corresponds to message.type.
 * When gateway passes resolved services (createApplicationContext), use them; else use injected.
 */
@Injectable()
export class MessageHandlerService {
  constructor(
    private readonly presence: PresenceService,
    private readonly sectorService: SectorService,
    private readonly broadcast: BroadcastService,
    private readonly chat: ChatService,
    private readonly player: PlayerService,
    private readonly db: DbService
  ) {}

  async handle(
    user: ResolvedUser,
    message: Record<string, unknown>,
    socket: GameSocket,
    resolved?: GatewayResolvedServices
  ): Promise<void> {
    const services: HandlerServices = {
      presence: resolved?.presence ?? this.presence,
      sectorService: resolved?.sectorService ?? this.sectorService,
      broadcast: resolved?.broadcast ?? this.broadcast,
      chat: resolved?.chat ?? this.chat,
      player: resolved?.player ?? this.player,
      db: resolved?.db ?? this.db,
    };

    if (message.type === "update") {
      await this.handleUpdate(user, message, services);
      return;
    }
    if (message.type === "player_dead") {
      this.handlePlayerDead(user, services);
      return;
    }
    if (message.type === "respawn" || message.type === "respawn_vengeance") {
      await this.handleRespawn(user, message, socket, services);
      return;
    }
    if (message.type === "use_black_hole") {
      await this.handleUseBlackHole(user, message, services);
      return;
    }
    if (message.type === "pickup_collect") {
      await this.handlePickupCollect(user, message, services);
      return;
    }
    if (message.type === "skill_immunity") {
      this.handleSkillImmunity(user, message, services);
      return;
    }
    if (message.type === "skill_healing") {
      this.handleSkillHealing(user, message, services);
      return;
    }
    if (message.type === "skill_fury") {
      this.handleSkillFury(user, message, services);
      return;
    }
    if (message.type === "skill_gravity_pit") {
      this.handleSkillGravityPit(user, message, services);
      return;
    }
    if (message.type === "skill_teleport") {
      this.handleSkillTeleport(user, message, socket, services);
      return;
    }
    if (message.type === "enemy_hit") {
      await this.handleEnemyHit(user, message, services);
      return;
    }
    if (message.type === "player_hit") {
      await this.handlePlayerHit(user, message, services);
      return;
    }
    if (message.type === "asteroid_destroy") {
      this.handleAsteroidDestroy(user, message, services);
      return;
    }
    if (message.type === "chat_message") {
      await this.handleChatMessage(user, message, services);
      return;
    }
    if (message.type === "request_exit") {
      this.handleRequestExit(user, socket, services);
      return;
    }
    if (message.type === "disconnect") {
      socket.close(1000);
      return;
    }
  }

  private async handleUpdate(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): Promise<void> {
    const next = services.presence.getEntry(user.id);
    if (!next) return;

    startSpawnImmunityIfNeeded(next, user.id, services);
    const newX = Number(message.x) ?? next.x;
    const newY = Number(message.y) ?? next.y;
    const moved = newX !== next.x || newY !== next.y;
    if (moved) startSpawnImmunityIfNeeded(next, user.id, services);

    next.x = newX;
    next.y = newY;
    next.rotation = Number(message.rotation) ?? next.rotation;
    if (message.shipChoice === "keeper19" || message.shipChoice === "keeper20") {
      next.shipChoice = message.shipChoice as string;
    }
    const level = Number(message.level);
    const health = Number(message.health);
    const maxHealth = Number(message.maxHealth);
    const firingAt = message.firingAt == null ? null : Number(message.firingAt ?? 0);
    if (Number.isFinite(health) && health >= 0) next.health = health;
    if (Number.isFinite(maxHealth) && maxHealth > 0) next.maxHealth = maxHealth;
    if (Number.isFinite(level) && level > 0) next.level = level;
    next.firingAt = Number.isFinite(firingAt) ? firingAt : null;
    next.updatedAt = Date.now();
    services.presence.setEntry(user.id, next);
    if (next.sectorId) services.broadcast.broadcastPresence(next.sectorId, services.presence);

    const now = Date.now();
    if (now - next.lastSavedAt > 2000) {
      next.lastSavedAt = now;
      void services.player.savePlayerPosition(next, services.db);
    }
  }

  private handlePlayerDead(user: ResolvedUser, services: HandlerServices): void {
    const entry = services.presence.getEntry(user.id);
    if (entry && !entry.isDead) {
      entry.isDead = true;
      entry.updatedAt = Date.now();
      services.presence.setEntry(user.id, entry);
      if (entry.sectorId) services.broadcast.broadcastPresence(entry.sectorId, services.presence);
    }
  }

  private async handleRespawn(
    user: ResolvedUser,
    message: Record<string, unknown>,
    socket: GameSocket,
    services: HandlerServices
  ): Promise<void> {
    const entry = services.presence.getEntry(user.id);
    if (!entry) return;

    const isVengeance = message.type === "respawn_vengeance";
    const vengeanceTargetUserId = isVengeance ? Number(message.killedByUserId) : null;
    const sector =
      services.sectorService.sectors.get(entry.sectorId) ??
      services.sectorService.findOrCreateSector(1, undefined, services.presence);
    entry.sectorId = sector.id;
    const spawnX = randBetween(120, sector.config.width - 120);
    const spawnY = randBetween(120, sector.config.height - 120);
    const rotation = 0;
    const monsterKey = normalizeMonsterChoice(entry?.shipChoice);
    let level = entry.level || 1;
    let exp = 0;
    let expToNext = expToNextLevel(level);
    let resources: { scrap: number; tokens: number } = { scrap: 0, tokens: 0 };
    const expResult = await services.db.pool.query(
      `SELECT exp, "expToNext", resources, "monsterProgress" FROM players WHERE "userId" = $1`,
      [user.id]
    );
    if (expResult.rowCount && expResult.rowCount > 0) {
      const progress = (expResult.rows[0].monsterProgress as Record<string, unknown>) || {};
      const stored = getMonsterProgressEntry(progress, monsterKey);
      if (stored) {
        level = Number(stored.level) || level;
        exp = Number(stored.exp) || 0;
        expToNext = Number(stored.expToNext) || expToNextLevel(level);
      } else {
        exp = Number(expResult.rows[0].exp) || 0;
        expToNext = Number(expResult.rows[0].expToNext) || expToNextLevel(level);
      }
      resources = (expResult.rows[0].resources as { scrap: number; tokens: number }) || resources;
    }
    const stats = playerStatsForLevel(level, monsterKey);
    const energyCap = energyCapForLevel(level);
    const nextResources = { scrap: energyCap, tokens: Number(resources.tokens || 0) };
    const progress = expResult.rowCount && expResult.rowCount > 0
      ? ((expResult.rows[0].monsterProgress as Record<string, unknown>) || {})
      : {};
    const nextProgress = {
      ...progress,
      [monsterKey]: {
        level,
        exp,
        expToNext,
        maxHealth: stats.maxHealth,
        damage: stats.damage,
        health: stats.maxHealth,
      },
    };
    await services.db.pool.query(
      `UPDATE players SET "posX" = $1, "posY" = $2, "rotation" = $3, "lastPositionAt" = NOW(), "lastHealthAt" = NOW(), health = $4, "maxHealth" = $5, resources = $6, "monsterProgress" = $7 WHERE "userId" = $8`,
      [spawnX, spawnY, rotation, stats.maxHealth, stats.maxHealth, nextResources, nextProgress, user.id]
    );
    const invulnerableUntil = Date.now() + 10000;
    const zone = sector.world.safeZone;
    const initialInSafeZone =
      zone &&
      zone.expiresAt > Date.now() &&
      services.sectorService.isInsideSafeZone(zone, spawnX, spawnY);
    entry.x = spawnX;
    entry.y = spawnY;
    entry.rotation = rotation;
    entry.health = stats.maxHealth;
    entry.maxHealth = stats.maxHealth;
    entry.level = level;
    entry.invulnerableUntil = invulnerableUntil;
    entry.isDead = false;
    entry.updatedAt = Date.now();
    entry.wasInSafeZone = !!initialInSafeZone;
    if (isVengeance && Number.isFinite(vengeanceTargetUserId) && vengeanceTargetUserId! > 0) {
      entry.vengeanceTargetUserId = vengeanceTargetUserId!;
      entry.vengeanceExpiresAt = Date.now() + VENGEANCE_DURATION_MS;
      entry.huntedByUserId = undefined;
      entry.huntedExpiresAt = undefined;
    } else {
      entry.vengeanceTargetUserId = undefined;
      entry.vengeanceExpiresAt = undefined;
    }
    services.presence.setEntry(user.id, entry);
    const sockets = services.presence.getSockets(user.id);
    if (sockets) {
      for (const s of sockets) {
        (s as GameSocket).sectorId = sector.id;
      }
    }
    if (entry.vengeanceExpiresAt && entry.vengeanceTargetUserId) {
      const targetUserId = entry.vengeanceTargetUserId;
      const targetEntry = services.presence.getEntry(targetUserId);
      const targetSector = targetEntry?.sectorId
        ? services.sectorService.sectors.get(targetEntry.sectorId)
        : null;
      services.broadcast.sendSelfUpdate(
        user.id,
        {
          vengeance: {
            targetUserId,
            targetNickname: targetEntry?.nickname ?? `Пилот ${targetUserId}`,
            expiresAt: entry.vengeanceExpiresAt,
            targetSectorId: targetEntry?.sectorId ?? null,
            targetSectorName: targetSector?.name ?? null,
          },
          hunted: null,
        },
        services.presence
      );
      if (targetEntry) {
        targetEntry.huntedByUserId = user.id;
        targetEntry.huntedExpiresAt = entry.vengeanceExpiresAt;
        targetEntry.updatedAt = Date.now();
        services.presence.setEntry(targetUserId, targetEntry);
        const huntedPayload = {
          hunted: {
            hunterUserId: user.id,
            hunterNickname: entry.nickname ?? `Пилот ${user.id}`,
            expiresAt: entry.vengeanceExpiresAt,
          },
        };
        services.broadcast.sendSelfUpdate(targetUserId, huntedPayload, services.presence);
        if (targetEntry.sectorId) services.broadcast.broadcastPresence(targetEntry.sectorId, services.presence);
      }
    }
    if (entry.huntedExpiresAt && entry.huntedByUserId && entry.huntedExpiresAt > Date.now()) {
      const hunterEntry = services.presence.getEntry(entry.huntedByUserId);
      services.broadcast.sendSelfUpdate(
        user.id,
        {
          hunted: {
            hunterUserId: entry.huntedByUserId,
            hunterNickname: hunterEntry?.nickname ?? `Пилот ${entry.huntedByUserId}`,
            expiresAt: entry.huntedExpiresAt,
          },
        },
        services.presence
      );
    }
    try {
      const messages = await services.chat.loadChatHistory("sector", sector.id, services.db);
      const socks = services.presence.getSockets(user.id);
      if (socks) {
        const payload = JSON.stringify({
          type: "chat_history",
          scope: "sector",
          sectorId: sector.id,
          messages,
        });
        for (const s of socks) {
          if (s.readyState === 1) s.send(payload);
        }
      }
    } catch {
      // ignore
    }
    services.broadcast.broadcastPresence(sector.id, services.presence);
    services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
    services.broadcast.sendPlayerUpdate(
      user.id,
      {
        level,
        exp,
        expToNext,
        maxHealth: stats.maxHealth,
        damage: stats.damage,
        health: stats.maxHealth,
        resources: nextResources,
        posX: spawnX,
        posY: spawnY,
        rotation,
        lastPositionAt: new Date().toISOString(),
      },
      services.presence
    );
    services.broadcast.sendSelfUpdate(user.id, { serverTime: Date.now(), invulnerableUntil }, services.presence);
  }

  private async handleUseBlackHole(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): Promise<void> {
    const entry = services.presence.getEntry(user.id);
    if (!entry) return;
    startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = services.sectorService.sectors.get(entry.sectorId);
    const holes = Array.isArray(sector?.world.blackHoles) ? sector!.world.blackHoles : [];
    if (!sector || holes.length === 0) return;
    const blackHoleId = message.blackHoleId as string | undefined;
    let hole =
      typeof blackHoleId === "string" && holes.find((h: { id: string }) => h.id === blackHoleId);
    if (!hole) {
      const now = Date.now();
      let nearestDist = Infinity;
      for (const h of holes) {
        if (h.expiresAt <= now || (h.appearsAt ?? 0) > now) continue;
        const dist = Math.hypot(entry.x - h.x, entry.y - h.y);
        if (dist <= 90 && dist < nearestDist) {
          nearestDist = dist;
          hole = h;
        }
      }
    }
    const now = Date.now();
    if (!hole || hole.expiresAt <= now || (hole.appearsAt ?? 0) > now) return;
    const dx = entry.x - hole.x;
    const dy = entry.y - hole.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 90) return;
    const targetSectorId = hole.targetSectorId;
    const targetLevel = Number(hole.targetLevel);
    if (targetSectorId === entry.sectorId) return;
    if (targetSectorId && Number.isFinite(targetLevel)) {
      if (sector.level === 1 && targetLevel === 2 && (entry.level || 1) < 3) return;
    }
    sector.world.blackHoles = sector.world.blackHoles.filter((h: { id: string }) => h.id !== hole!.id);
    services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
    if (targetSectorId && Number.isFinite(targetLevel)) {
      await this.movePlayerToSectorById(user.id, targetSectorId, targetLevel, services);
      return;
    }
    await this.movePlayerToSector(user.id, sector.level, services);
  }

  private async movePlayerToSector(userId: number, nextLevel: number, services: HandlerServices): Promise<void> {
    const entry = services.presence.getEntry(userId);
    if (!entry) return;
    const previousSector = entry.sectorId ? services.sectorService.sectors.get(entry.sectorId) : null;
    const targetSector = services.sectorService.findOrCreateSector(nextLevel, previousSector?.id, services.presence);
    const spawnX = randBetween(120, targetSector.config.width - 120);
    const spawnY = randBetween(120, targetSector.config.height - 120);
    const zone = targetSector.world.safeZone;
    const initialInSafeZone =
      zone &&
      zone.expiresAt > Date.now() &&
      services.sectorService.isInsideSafeZone(zone, spawnX, spawnY);
    entry.sectorId = targetSector.id;
    entry.x = spawnX;
    entry.y = spawnY;
    entry.rotation = 0;
    entry.invulnerableUntil = Date.now() + 10000;
    entry.updatedAt = Date.now();
    entry.wasInSafeZone = !!initialInSafeZone;
    services.presence.setEntry(userId, entry);
    const sockets = services.presence.getSockets(userId);
    if (sockets) for (const s of sockets) (s as GameSocket).sectorId = targetSector.id;
    if (previousSector) {
      services.broadcast.broadcastPresence(previousSector.id, services.presence);
      services.broadcast.broadcastWorld(previousSector.id, services.sectorService, services.presence);
    }
    services.broadcast.broadcastPresence(targetSector.id, services.presence);
    services.broadcast.broadcastWorld(targetSector.id, services.sectorService, services.presence);
    services.broadcast.notifyHuntersOfTargetSectorChange(userId, services.presence, services.sectorService);
    services.broadcast.sendPlayerUpdate(
      userId,
      { posX: spawnX, posY: spawnY, rotation: 0, lastPositionAt: new Date().toISOString() },
      services.presence
    );
    services.broadcast.sendSelfUpdate(userId, { serverTime: Date.now(), invulnerableUntil: entry.invulnerableUntil }, services.presence);
    try {
      const messages = await services.chat.loadChatHistory("sector", targetSector.id, services.db);
      const socks = services.presence.getSockets(userId);
      if (socks) {
        const payload = JSON.stringify({ type: "chat_history", scope: "sector", sectorId: targetSector.id, messages });
        for (const s of socks) if (s.readyState === 1) s.send(payload);
      }
    } catch {
      // ignore
    }
    try {
      await services.db.pool.query(
        `UPDATE players SET "posX" = $1, "posY" = $2, "rotation" = $3, "lastPositionAt" = NOW() WHERE "userId" = $4`,
        [spawnX, spawnY, 0, userId]
      );
    } catch (err) {
      console.error("Failed to persist sector travel:", err);
    }
  }

  private async movePlayerToSectorById(
    userId: number,
    targetSectorId: string,
    fallbackLevel: number,
    services: HandlerServices
  ): Promise<void> {
    const entry = services.presence.getEntry(userId);
    if (!entry) return;
    const previousSector = services.sectorService.sectors.get(entry.sectorId);
    const targetSector =
      services.sectorService.sectors.get(targetSectorId) ??
      services.sectorService.createSector(Number.isFinite(fallbackLevel) ? fallbackLevel : previousSector?.level ?? 1);
    const spawnX = randBetween(120, targetSector.config.width - 120);
    const spawnY = randBetween(120, targetSector.config.height - 120);
    const zone = targetSector.world.safeZone;
    const initialInSafeZone =
      zone &&
      zone.expiresAt > Date.now() &&
      services.sectorService.isInsideSafeZone(zone, spawnX, spawnY);
    entry.sectorId = targetSector.id;
    entry.x = spawnX;
    entry.y = spawnY;
    entry.rotation = 0;
    entry.invulnerableUntil = Date.now() + 10000;
    entry.updatedAt = Date.now();
    entry.wasInSafeZone = !!initialInSafeZone;
    services.presence.setEntry(userId, entry);
    const sockets = services.presence.getSockets(userId);
    if (sockets) for (const s of sockets) (s as GameSocket).sectorId = targetSector.id;
    if (previousSector) {
      services.broadcast.broadcastPresence(previousSector.id, services.presence);
      services.broadcast.broadcastWorld(previousSector.id, services.sectorService, services.presence);
    }
    services.broadcast.broadcastPresence(targetSector.id, services.presence);
    services.broadcast.broadcastWorld(targetSector.id, services.sectorService, services.presence);
    services.broadcast.notifyHuntersOfTargetSectorChange(userId, services.presence, services.sectorService);
    services.broadcast.sendPlayerUpdate(
      userId,
      { posX: spawnX, posY: spawnY, rotation: 0, lastPositionAt: new Date().toISOString() },
      services.presence
    );
    services.broadcast.sendSelfUpdate(userId, { serverTime: Date.now(), invulnerableUntil: entry.invulnerableUntil }, services.presence);
    try {
      const messages = await services.chat.loadChatHistory("sector", targetSector.id, services.db);
      const socks = services.presence.getSockets(userId);
      if (socks) {
        const payload = JSON.stringify({ type: "chat_history", scope: "sector", sectorId: targetSector.id, messages });
        for (const s of socks) if (s.readyState === 1) s.send(payload);
      }
    } catch {
      // ignore
    }
    try {
      await services.db.pool.query(
        `UPDATE players SET "posX" = $1, "posY" = $2, "rotation" = $3, "lastPositionAt" = NOW() WHERE "userId" = $4`,
        [spawnX, spawnY, 0, userId]
      );
    } catch (err) {
      console.error("Failed to persist sector travel:", err);
    }
  }

  private async handlePickupCollect(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): Promise<void> {
    const pickupId = Number(message.pickupId);
    const entry = services.presence.getEntry(user.id);
    if (entry) startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    if (!sector) return;
    const pickup = sector.world.pickups.get(pickupId);
    if (pickup) {
      sector.world.pickups.delete(pickupId);
      if (pickup.resource === "tokens" && (pickup.amount == null || pickup.amount > 0)) {
        const addTokens = Math.max(1, Number(pickup.amount) || 1);
        try {
          const res = await services.db.pool.query(`SELECT resources FROM players WHERE "userId" = $1`, [user.id]);
          if (res.rowCount && res.rowCount > 0) {
            const resources = (res.rows[0].resources as { scrap?: number; tokens?: number }) || { scrap: 0, tokens: 0 };
            const nextResources = {
              ...resources,
              tokens: (Number(resources.tokens ?? 0) || 0) + addTokens,
            };
            await services.db.pool.query(
              `UPDATE players SET resources = $1 WHERE "userId" = $2`,
              [nextResources, user.id]
            );
            services.broadcast.sendPlayerUpdate(user.id, { resources: nextResources }, services.presence);
          }
        } catch (err) {
          console.error("Failed to grant token pickup:", err);
        }
      } else if (pickup.resource !== "tokens") {
        setTimeout(() => {
          services.sectorService.spawnPickupPublic(
            sector,
            pickup.resource,
            randBetween(100, sector.config.width - 100),
            randBetween(100, sector.config.height - 100)
          );
          services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        }, PICKUP_RESPAWN_MS);
      }
      services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
    }
  }

  private handleSkillImmunity(user: ResolvedUser, message: Record<string, unknown>, services: HandlerServices): void {
    const entry = services.presence.getEntry(user.id);
    if (entry) startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    const zone = sector?.world?.safeZone;
    if (
      entry &&
      (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))
    ) {
      const durationMs = Math.min(10000, Math.max(1000, Number(message.durationMs) || 5000));
      entry.invulnerableUntil = Date.now() + durationMs;
      services.broadcast.broadcastPresence(entry.sectorId, services.presence);
      services.broadcast.sendSelfUpdate(user.id, { serverTime: Date.now(), invulnerableUntil: entry.invulnerableUntil }, services.presence);
    }
  }

  private handleSkillHealing(user: ResolvedUser, message: Record<string, unknown>, services: HandlerServices): void {
    const entry = services.presence.getEntry(user.id);
    if (entry) startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    const zone = sector?.world?.safeZone;
    if (
      entry &&
      (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))
    ) {
      const durationMs = Math.min(10000, Math.max(1000, Number(message.durationMs) || 5000));
      entry.healingExpiresAt = Date.now() + durationMs;
      entry.lastHealingRegenAt = 0;
      services.broadcast.broadcastPresence(entry.sectorId, services.presence);
    }
  }

  private handleSkillFury(user: ResolvedUser, message: Record<string, unknown>, services: HandlerServices): void {
    const entry = services.presence.getEntry(user.id);
    if (entry) startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    const zone = sector?.world?.safeZone;
    if (
      entry &&
      (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))
    ) {
      const durationMs = Math.min(15000, Math.max(1000, Number(message.durationMs) || 7000));
      entry.furyExpiresAt = Date.now() + durationMs;
      services.broadcast.broadcastPresence(entry.sectorId, services.presence);
    }
  }

  private handleSkillGravityPit(user: ResolvedUser, message: Record<string, unknown>, services: HandlerServices): void {
    const entry = services.presence.getEntry(user.id);
    if (entry) startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    const zone = sector?.world?.safeZone;
    if (
      entry &&
      sector &&
      (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))
    ) {
      const margin = 100;
      const x = Math.min(sector.config.width - margin, Math.max(margin, entry.x));
      const y = Math.min(sector.config.height - margin, Math.max(margin, entry.y));
      if (!Array.isArray(sector.world.gravityPits)) sector.world.gravityPits = [];
      sector.world.gravityPits.push({
        id: `gp-${Date.now()}-${randInt(100, 999)}`,
        x,
        y,
        radius: GRAVITY_PIT_RADIUS,
        expiresAt: Date.now() + GRAVITY_PIT_DURATION_MS,
        ownerUserId: user.id,
      });
      services.broadcast.broadcastWorld(entry.sectorId, services.sectorService, services.presence);
    }
  }

  private handleSkillTeleport(
    user: ResolvedUser,
    message: Record<string, unknown>,
    socket: GameSocket,
    services: HandlerServices
  ): void {
    const entry = services.presence.getEntry(user.id);
    if (entry) startSpawnImmunityIfNeeded(entry, user.id, services);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    const zone = sector?.world?.safeZone;
    if (
      entry &&
      sector &&
      (!zone || zone.expiresAt <= Date.now() || !services.sectorService.isInsideSafeZone(zone, entry.x, entry.y))
    ) {
      const width = sector.config.width;
      const height = sector.config.height;
      const margin = 120;
      setTimeout(() => {
        const current = services.presence.getEntry(user.id);
        const currentSector = current ? services.sectorService.sectors.get(current.sectorId) : null;
        if (!current || !currentSector || currentSector.id !== sector.id) return;
        const x = randBetween(margin, width - margin);
        const y = randBetween(margin, height - margin);
        current.x = x;
        current.y = y;
        current.updatedAt = Date.now();
        services.presence.setEntry(user.id, current);
        services.broadcast.broadcastPresence(current.sectorId, services.presence);
        try {
          socket.send(JSON.stringify({ type: "teleport_complete", x, y }));
        } catch {
          // client may have disconnected
        }
      }, 3000);
    }
  }

  private async handleEnemyHit(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): Promise<void> {
    const enemyId = Number(message.enemyId);
    const requestedDamage = Math.max(0, Number(message.damage || 0));
    const presenceEntry = services.presence.getEntry(user.id);
    if (presenceEntry) startSpawnImmunityIfNeeded(presenceEntry, user.id, services);
    const level = presenceEntry?.level || 1;
    const maxDamage = playerStatsForLevel(level, presenceEntry?.shipChoice).damage;
    const continuousLaser = Boolean(message.continuousLaser);
    const damageCap = continuousLaser ? maxDamage * 3 : maxDamage;
    let damage = Math.min(requestedDamage || 0, damageCap);
    const now = Date.now();
    if (presenceEntry?.furyExpiresAt && presenceEntry.furyExpiresAt > now) {
      damage = Math.round(damage * FURY_DAMAGE_MULT);
    }
    const sector = presenceEntry ? services.sectorService.sectors.get(presenceEntry.sectorId) : null;
    if (!sector) return;
    const enemy = sector.world.enemies.get(enemyId);
    if (enemy && damage > 0) {
      enemy.health = Math.max(0, enemy.health - damage);
      if (enemy.health <= 0) {
        sector.world.enemies.delete(enemyId);
        const expGain = Math.max(1, Math.floor((25 + enemy.level * 10) / 5));
        const tokenAmount = tokensForMobLevel(enemy.level);
        const tokenId = services.sectorService.spawnPickupPublic(
          sector,
          "tokens",
          enemy.x,
          enemy.y,
          tokenAmount
        );
        services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        setTimeout(() => {
          services.sectorService.spawnEnemyPublic(sector);
          services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
        }, ENEMY_RESPAWN_MS);
        setTimeout(() => {
          if (sector.world.pickups.delete(tokenId)) {
            services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
          }
        }, PICKUP_RESPAWN_MS);
        try {
          const progress = await services.player.awardPlayerExp(user.id, expGain, presenceEntry?.shipChoice, services.db);
          if (progress) {
            services.broadcast.sendPlayerUpdate(user.id, progress, services.presence);
            if (presenceEntry) {
              presenceEntry.level = progress.level;
              presenceEntry.maxHealth = progress.maxHealth;
              if (typeof progress.health === "number") presenceEntry.health = progress.health;
            }
            if (progress.previousLevel != null && progress.level > progress.previousLevel) {
              try {
                const nickname = presenceEntry?.nickname ?? "Игрок";
                const chatEntry = {
                  id: `level-${Date.now()}-${user.id}`,
                  userId: user.id,
                  nickname: "Система",
                  text: `${nickname} достиг уровня ${progress.level}.`,
                  createdAt: Date.now(),
                };
                await services.chat.persistChatMessage(chatEntry as Parameters<ChatService["persistChatMessage"]>[0], "global", "", services.db);
                services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
              } catch {
                // ignore
              }
            }
          }
        } catch (err) {
          console.error("Failed to award exp:", err);
        }
      } else {
        services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
      }
    }
  }

  private handleAsteroidDestroy(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): void {
    const asteroidId = Number(message.asteroidId);
    const entry = services.presence.getEntry(user.id);
    const sector = entry ? services.sectorService.sectors.get(entry.sectorId) : null;
    if (sector && sector.world.asteroids.delete(asteroidId)) {
      services.broadcast.broadcastWorld(sector.id, services.sectorService, services.presence);
    }
  }

  private async handleChatMessage(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): Promise<void> {
    const text = String(message.text ?? "").trim();
    if (!text) return;
    const safeText = text.slice(0, 240);
    const scope = message.scope === "global" ? "global" : "sector";
    const entry = services.presence.getEntry(user.id);
    const sectorId = entry?.sectorId ?? "unknown";
    const nickname = entry?.nickname ?? user.nickname ?? `Пилот ${user.id}`;
    const chatEntry = {
      id: `${Date.now()}-${user.id}`,
      userId: user.id,
      nickname,
      text: safeText,
      createdAt: Date.now(),
    };
    await services.chat.persistChatMessage(
      chatEntry as Parameters<ChatService["persistChatMessage"]>[0],
      scope,
      sectorId,
      services.db
    );
    services.broadcast.broadcastChat(chatEntry, scope, sectorId, services.presence);
  }

  private handleRequestExit(
    user: ResolvedUser,
    socket: GameSocket,
    services: HandlerServices
  ): void {
    const entry = services.presence.getEntry(user.id);
    if (entry) {
      const now = Date.now();
      entry.invulnerableUntil = Math.max(entry.invulnerableUntil || 0, now + EXIT_GRACE_MS + 1000);
      services.presence.setEntry(user.id, entry);
      services.broadcast.broadcastPresence(entry.sectorId, services.presence);
      services.broadcast.sendSelfUpdate(user.id, { serverTime: now, invulnerableUntil: entry.invulnerableUntil }, services.presence);
      setTimeout(async () => {
        const current = services.presence.getEntry(user.id);
        if (current) await services.player.savePlayerPosition(current, services.db);
        try {
          socket.send(JSON.stringify({ type: "exit_ready" }));
        } catch {
          // client may already be gone
        }
        socket.close(1000);
      }, EXIT_GRACE_MS);
    } else {
      socket.close(1000);
    }
  }

  // player_hit is large; implemented in next chunk
  private async handlePlayerHit(
    user: ResolvedUser,
    message: Record<string, unknown>,
    services: HandlerServices
  ): Promise<void> {
    const targetUserId = Number(message.targetUserId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) return;
    const attacker = services.presence.getEntry(user.id);
    const victim = services.presence.getEntry(targetUserId);
    if (!attacker || !victim) return;
    if (attacker.isDead || victim.isDead) return;
    if (!attacker.sectorId || attacker.sectorId !== victim.sectorId) return;
    const sector = services.sectorService.sectors.get(attacker.sectorId);
    if (sector?.world.safeZone) {
      if (
        services.sectorService.isInsideSafeZone(sector.world.safeZone, attacker.x, attacker.y) ||
        services.sectorService.isInsideSafeZone(sector.world.safeZone, victim.x, victim.y)
      )
        return;
    }
    const now = Date.now();
    if (victim.invulnerableUntil && victim.invulnerableUntil > now) return;
    const requestedDamage = Math.max(0, Number(message.damage || 0));
    const maxDamage = playerStatsForLevel(attacker.level || 1, attacker.shipChoice).damage;
    const continuousLaser = Boolean(message.continuousLaser);
    const damageCap = continuousLaser ? maxDamage * 3 : maxDamage;
    let damage = Math.min(requestedDamage || 0, damageCap);
    if (attacker.furyExpiresAt && attacker.furyExpiresAt > now) {
      damage = Math.round(damage * FURY_DAMAGE_MULT);
    }
    if (attacker.vengeanceTargetUserId === targetUserId && attacker.vengeanceExpiresAt && attacker.vengeanceExpiresAt > now) {
      damage = Math.round(damage * VENGEANCE_DAMAGE_MULT);
    }
    if (!damage) return;

    const victimRow = await services.db.pool.query(
      `SELECT health, exp, resources, "monsterProgress" FROM players WHERE "userId" = $1`,
      [targetUserId]
    );
    if (!victimRow.rowCount || victimRow.rowCount === 0) return;
    const storedHealth = Number(victimRow.rows[0].health);
    const currentHealth = Number.isFinite(storedHealth) ? storedHealth : Number(victim.health || 0);
    const victimInFury = victim.furyExpiresAt && victim.furyExpiresAt > now;
    const minHealth = victimInFury ? 1 : 0;
    const nextHealth = Math.max(minHealth, currentHealth - damage);

    let resources = (victimRow.rows[0].resources as { scrap?: number; tokens?: number }) || { scrap: 0, tokens: 0 };
    const tokens = Number(resources.tokens ?? 0) || 0;
    let exp = Number(victimRow.rows[0].exp ?? 0) || 0;
    const progress = (victimRow.rows[0].monsterProgress as Record<string, unknown>) || {};
    const victimMonsterKey = normalizeMonsterChoice(victim.shipChoice);
    const storedProgress = getMonsterProgressEntry(progress, victimMonsterKey) || {};
    const nextProgress = {
      ...progress,
      [victimMonsterKey]: { ...storedProgress, exp, health: nextHealth },
    };

    let death: { lostTokens: number; lostExp: number; killedBy: string; killedByUserId: number } | null = null;
    const diedNow = currentHealth > 0 && nextHealth === 0;
    if (diedNow) {
      const tokenPercent = (Math.max(1, Math.floor(Math.random() * 30) + 1)) / 100;
      const expPercent = (Math.max(1, Math.floor(Math.random() * 30) + 1)) / 100;
      let lostTokens = Math.floor(tokens * tokenPercent);
      let lostExp = Math.floor(exp * expPercent);
      if (tokens > 0 && lostTokens === 0) lostTokens = 1;
      if (exp > 0 && lostExp === 0) lostExp = 1;
      resources = { ...resources, tokens: Math.max(0, tokens - lostTokens) };
      exp = Math.max(0, exp - lostExp);
      death = {
        lostTokens,
        lostExp,
        killedBy: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
        killedByUserId: user.id,
      };
      services.broadcast.broadcastToSector(
        attacker.sectorId,
        {
          type: "sector_kill_flash",
          killerName: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
          victimName: victim.nickname ?? `Пилот ${targetUserId}`,
        },
        services.presence
      );
      try {
        const chatEntry = {
          id: `${Date.now()}-pvp-${user.id}-${targetUserId}`,
          userId: user.id,
          nickname: "Система",
          text: `${death.killedBy} убил ${victim.nickname ?? `Пилот ${targetUserId}`}.`,
          createdAt: Date.now(),
        };
        await services.chat.persistChatMessage(chatEntry as Parameters<ChatService["persistChatMessage"]>[0], "global", "", services.db);
        services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
      } catch {
        // ignore
      }
      try {
        if (lostTokens > 0) {
          const killerRow = await services.db.pool.query(`SELECT resources FROM players WHERE "userId" = $1`, [user.id]);
          const killerResources =
            killerRow.rowCount && killerRow.rows[0]
              ? ((killerRow.rows[0].resources as { scrap?: number; tokens?: number }) || { scrap: 0, tokens: 0 })
              : { scrap: 0, tokens: 0 };
          const killerTokens = Number(killerResources.tokens ?? 0) || 0;
          (killerResources as { tokens: number }).tokens = killerTokens + lostTokens;
          await services.db.pool.query(`UPDATE players SET resources = $1 WHERE "userId" = $2`, [killerResources, user.id]);
          services.broadcast.sendPlayerUpdate(user.id, { resources: killerResources }, services.presence);
        }
        if (lostExp > 0) {
          const progress = await services.player.awardPlayerExp(user.id, lostExp, attacker.shipChoice, services.db);
          if (progress) {
            services.broadcast.sendPlayerUpdate(user.id, progress, services.presence);
            attacker.level = progress.level;
            attacker.maxHealth = progress.maxHealth;
            if (typeof progress.health === "number") attacker.health = progress.health;
            services.presence.setEntry(user.id, attacker);
            if (progress.previousLevel != null && progress.level > progress.previousLevel) {
              try {
                const chatEntry = {
                  id: `level-${Date.now()}-${user.id}-pvp`,
                  userId: user.id,
                  nickname: "Система",
                  text: `${attacker.nickname ?? "Игрок"} достиг уровня ${progress.level}.`,
                  createdAt: Date.now(),
                };
                await services.chat.persistChatMessage(chatEntry as Parameters<ChatService["persistChatMessage"]>[0], "global", "", services.db);
                services.broadcast.broadcastChat(chatEntry, "global", "", services.presence);
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to award PvP rewards:", err);
      }
      victim.isDead = true;
    }

    try {
      await services.db.pool.query(
        `UPDATE players SET health = $1, "lastHealthAt" = NOW(), exp = $2, resources = $3, "monsterProgress" = $4 WHERE "userId" = $5`,
        [nextHealth, exp, resources, nextProgress, targetUserId]
      );
    } catch (err) {
      console.error("Failed to persist PvP damage:", err);
    }

    victim.health = nextHealth;
    victim.updatedAt = Date.now();
    if (death) {
      if (attacker.vengeanceTargetUserId === targetUserId) {
        attacker.vengeanceTargetUserId = undefined;
        attacker.vengeanceExpiresAt = undefined;
        attacker.updatedAt = Date.now();
        services.presence.setEntry(user.id, attacker);
        services.broadcast.sendSelfUpdate(user.id, { vengeance: null }, services.presence);
      }
      if (victim.huntedByUserId === user.id) {
        victim.huntedByUserId = undefined;
        victim.huntedExpiresAt = undefined;
        services.broadcast.sendSelfUpdate(targetUserId, { hunted: null }, services.presence);
      } else {
        victim.huntedByUserId = user.id;
        victim.huntedExpiresAt = Date.now() + VENGEANCE_DURATION_MS;
      }
    }
    services.presence.setEntry(targetUserId, victim);
    services.broadcast.broadcastPresence(attacker.sectorId, services.presence);
    services.broadcast.sendPlayerUpdate(targetUserId, { health: nextHealth, exp, resources }, services.presence);
    services.broadcast.broadcastToSector(
      attacker.sectorId,
      {
        type: "player_shot_result",
        attackerUserId: user.id,
        victimUserId: targetUserId,
        attackerX: attacker.x,
        attackerY: attacker.y,
      },
      services.presence
    );
    if (death) {
      services.broadcast.sendDeathUpdate(targetUserId, death, services.presence);
      if (victim.huntedByUserId != null && victim.huntedExpiresAt != null) {
        const huntedPayload = {
          hunted: {
            hunterUserId: victim.huntedByUserId,
            hunterNickname: attacker.nickname ?? user.nickname ?? `Пилот ${user.id}`,
            expiresAt: victim.huntedExpiresAt,
          },
        };
        services.broadcast.sendSelfUpdate(targetUserId, huntedPayload, services.presence);
      }
    }
  }
}
