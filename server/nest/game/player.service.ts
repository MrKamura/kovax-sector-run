import { Injectable } from "@nestjs/common";
import {
  SPAWN_IMMUNITY_UNTIL_FIRST_ACTION,
  SPAWN_IMMUNITY_AFTER_ACTION_MS,
} from "../config/constants";
import type { PresenceEntry } from "./types";
import { DbService } from "./db.service";
import { BroadcastService } from "./broadcast.service";
import {
  clampLevel,
  expToNextLevel,
  playerStatsForLevel,
  normalizeMonsterChoice,
  getMonsterProgressEntry,
} from "./utils";

@Injectable()
export class PlayerService {
  constructor(
    private readonly db: DbService,
    private readonly broadcast: BroadcastService
  ) {}

  async savePlayerPosition(entry: PresenceEntry | undefined, dbOverride?: DbService): Promise<void> {
    if (!entry) return;
    const db = dbOverride ?? this.db;
    if (!db?.pool) return;
    try {
      await db.pool.query(
        `UPDATE players SET "posX" = $1, "posY" = $2, "rotation" = $3, "lastPositionAt" = NOW() WHERE "userId" = $4`,
        [entry.x, entry.y, entry.rotation, entry.userId]
      );
    } catch (err) {
      console.error("Failed to persist player position:", err);
    }
  }

  startSpawnImmunityCountdownIfNeeded(
    entry: PresenceEntry | undefined,
    userId: number,
    presence: { setEntry: (id: number, e: PresenceEntry) => void }
  ): void {
    if (!entry || entry.invulnerableUntil < SPAWN_IMMUNITY_UNTIL_FIRST_ACTION) return;
    const now = Date.now();
    entry.invulnerableUntil = now + SPAWN_IMMUNITY_AFTER_ACTION_MS;
    presence.setEntry(userId, entry);
    this.broadcast.sendSelfUpdate(userId, {
      serverTime: now,
      invulnerableUntil: entry.invulnerableUntil,
    });
  }

  async awardPlayerExp(
    userId: number,
    amount: number,
    shipChoice: string | null | undefined,
    dbOverride?: DbService
  ): Promise<{
    level: number;
    exp: number;
    expToNext: number;
    maxHealth: number;
    damage: number;
    previousLevel: number;
    health?: number;
    resources?: { scrap: number; tokens: number };
  } | null> {
    if (!amount) return null;
    const db = dbOverride ?? this.db;
    if (!db?.pool) return null;
    const monsterKey = normalizeMonsterChoice(shipChoice);
    const result = await db.pool.query(
      `SELECT level, exp, resources, "monsterProgress" FROM players WHERE "userId" = $1`,
      [userId]
    );
    if (result.rowCount === 0) return null;
    const progress = result.rows[0].monsterProgress || {};
    const stored = getMonsterProgressEntry(progress, monsterKey);
    const previousLevel = clampLevel(Number(stored?.level ?? result.rows[0].level) || 1);
    let level = previousLevel;
    let exp = Number(stored?.exp ?? result.rows[0].exp) || 0;
    let expToNext = expToNextLevel(level);
    const MAX_PLAYER_LEVEL = 100;
    if (level < MAX_PLAYER_LEVEL) {
      exp += amount;
      while (level < MAX_PLAYER_LEVEL && exp >= expToNext) {
        exp -= expToNext;
        level = clampLevel(level + 1);
        expToNext = expToNextLevel(level);
      }
      if (level >= MAX_PLAYER_LEVEL) {
        level = MAX_PLAYER_LEVEL;
        exp = 0;
        expToNext = expToNextLevel(level);
      }
    } else {
      level = MAX_PLAYER_LEVEL;
      exp = 0;
      expToNext = expToNextLevel(level);
    }
    const stats = playerStatsForLevel(level, monsterKey);
    const leveledUp = level > previousLevel;
    const health = leveledUp
      ? stats.maxHealth
      : Math.min(Number(stored?.health) || stats.maxHealth, stats.maxHealth);
    const nextProgress = {
      ...progress,
      [monsterKey]: {
        level,
        exp,
        expToNext,
        maxHealth: stats.maxHealth,
        damage: stats.damage,
        health,
      },
    };
    let nextResources = result.rows[0].resources || { scrap: 0, tokens: 0 };
    const BASE_ENERGY_CAP = 10;
    const ENERGY_CAP_PER_LEVEL = 3;
    if (leveledUp) {
      const energyCap = BASE_ENERGY_CAP + Math.max(0, level - 1) * ENERGY_CAP_PER_LEVEL;
      nextResources = {
        scrap: energyCap,
        tokens: Number(nextResources.tokens ?? 0) || 0,
      };
      await db.pool.query(
        `UPDATE players SET level = $1, exp = $2, "expToNext" = $3, "maxHealth" = $4, damage = $5, "monsterProgress" = $6, resources = $7 WHERE "userId" = $8`,
        [level, exp, expToNext, stats.maxHealth, stats.damage, nextProgress, nextResources, userId]
      );
    } else {
      await db.pool.query(
        `UPDATE players SET level = $1, exp = $2, "expToNext" = $3, "maxHealth" = $4, damage = $5, "monsterProgress" = $6 WHERE "userId" = $7`,
        [level, exp, expToNext, stats.maxHealth, stats.damage, nextProgress, userId]
      );
    }
    const out: {
      level: number;
      exp: number;
      expToNext: number;
      maxHealth: number;
      damage: number;
      previousLevel: number;
      health?: number;
      resources?: { scrap: number; tokens: number };
    } = {
      level,
      exp,
      expToNext,
      maxHealth: stats.maxHealth,
      damage: stats.damage,
      previousLevel,
    };
    if (leveledUp) {
      out.health = stats.maxHealth;
      out.resources = nextResources;
    }
    return out;
  }
}
