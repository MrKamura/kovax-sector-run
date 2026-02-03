import { z } from "zod";

// ─── Presence (other players list) ───────────────────────────────────────────
export const presenceEntrySchema = z.object({
  userId: z.number(),
  nickname: z.string().nullable(),
  shipChoice: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  level: z.number().optional(),
  health: z.number(),
  maxHealth: z.number(),
  invulnerableUntil: z.number().optional(),
  isDead: z.boolean().optional(),
  firingAt: z.number().nullable(),
  updatedAt: z.number(),
  huntedExpiresAt: z.number().optional(),
  isHunted: z.boolean().optional(),
});
export type PresenceEntrySchema = z.infer<typeof presenceEntrySchema>;

// ─── World state (sector, pickups, asteroids, enemies, etc.) ───────────────
export const sectorSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number(),
  color: z.string(),
  width: z.number(),
  height: z.number(),
});
export type SectorSchema = z.infer<typeof sectorSchema>;

export const blackHoleSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  type: z.enum(["warp", "same"]),
  targetSectorId: z.string().optional(),
  targetSectorName: z.string().optional(),
  targetLevel: z.number().optional(),
  targetColor: z.string().optional(),
  appearsAt: z.number().optional(),
  expiresAt: z.number(),
});
export type BlackHoleSchema = z.infer<typeof blackHoleSchema>;

export const safeZoneSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  radius: z.number(),
  expiresAt: z.number(),
  movesAt: z.number(),
  color: z.string(),
});
export type SafeZoneSchema = z.infer<typeof safeZoneSchema>;

export const pickupSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  resource: z.enum(["scrap", "tokens"]),
});
export type PickupSchema = z.infer<typeof pickupSchema>;

const asteroidTextureSchema = z.enum([
  "meteor_small",
  "meteor_big",
  "meteor_grey_small",
  "meteor_grey_big",
]);

export const asteroidSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  texture: asteroidTextureSchema,
  scale: z.number(),
});
export type AsteroidSchema = z.infer<typeof asteroidSchema>;

const enemyTextureSchema = z.enum([
  "mob_keeper19",
  "mob_keeper20",
  "enemy_blue_1",
  "enemy_red_2",
  "enemy_green_3",
  "enemy_black_4",
  "enemy_alt_blue",
  "enemy_alt_red",
  "enemy_alt_green",
  "enemy_alt_black",
]);

export const enemySchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  texture: enemyTextureSchema,
  level: z.number(),
  damage: z.number(),
  health: z.number(),
  maxHealth: z.number(),
});
export type EnemySchema = z.infer<typeof enemySchema>;

export const gravityPitSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  radius: z.number(),
  expiresAt: z.number(),
  ownerUserId: z.union([z.string(), z.number()]).optional(),
});
export type GravityPitSchema = z.infer<typeof gravityPitSchema>;

export const worldStateSchema = z.object({
  seed: z.number(),
  sector: sectorSchema.optional(),
  blackHoles: z.array(blackHoleSchema).optional(),
  safeZone: safeZoneSchema.nullable().optional(),
  pickups: z.array(pickupSchema),
  asteroids: z.array(asteroidSchema),
  enemies: z.array(enemySchema),
  gravityPits: z.array(gravityPitSchema).optional(),
});
export type WorldStateSchema = z.infer<typeof worldStateSchema>;

// ─── Store-related payloads (vengeance, hunted, death) ──────────────────────
export const vengeanceSchema = z.object({
  targetUserId: z.number(),
  targetNickname: z.string(),
  expiresAt: z.number(),
  targetSectorId: z.string().nullable(),
  targetSectorName: z.string().nullable(),
});

export const huntedSchema = z.object({
  hunterUserId: z.number(),
  hunterNickname: z.string(),
  expiresAt: z.number(),
});

export const deathInfoSchema = z.object({
  lostTokens: z.number(),
  lostExp: z.number(),
  killedBy: z.string().optional(),
  killedByUserId: z.number().optional(),
});
export type DeathInfoSchema = z.infer<typeof deathInfoSchema>;
export type VengeanceSchema = z.infer<typeof vengeanceSchema>;
export type HuntedSchema = z.infer<typeof huntedSchema>;

/** Store: level-up celebration from player_update response */
export const levelUpCelebrationSchema = z.object({
  level: z.number(),
  previousLevel: z.number(),
});
export type LevelUpCelebrationSchema = z.infer<typeof levelUpCelebrationSchema>;

/** Store: sector kill flash (killer/victim names) */
export const sectorKillFlashSchema = z.object({
  killerName: z.string(),
  victimName: z.string(),
});
export type SectorKillFlashSchema = z.infer<typeof sectorKillFlashSchema>;

/** Store: active skill effect (e.g. immunity timer) */
export const activeSkillEffectSchema = z.object({
  skillId: z.string(),
  expiresAt: z.number(),
});
export type ActiveSkillEffectSchema = z.infer<typeof activeSkillEffectSchema>;

/** Store: pending server skill effect (Phaser sends to server then clears) */
export const pendingServerSkillEffectSchema = z.object({
  skillId: z.string(),
  durationMs: z.number(),
});
export type PendingServerSkillEffectSchema = z.infer<typeof pendingServerSkillEffectSchema>;

// Partial player update (many fields optional)
export const playerUpdateSchema = z.object({
  level: z.number().optional(),
  exp: z.number().optional(),
  expToNext: z.number().optional(),
  maxHealth: z.number().optional(),
  damage: z.number().optional(),
  health: z.number().optional(),
  resources: z.object({ scrap: z.number(), tokens: z.number() }).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  rotation: z.number().optional(),
  lastPositionAt: z.string().optional(),
}).passthrough();
export type PlayerUpdateSchema = z.infer<typeof playerUpdateSchema>;

// ─── Socket message discriminated union ──────────────────────────────────────
export const socketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("presence"),
    players: z.array(presenceEntrySchema),
    serverTime: z.number().optional(),
  }),
  z.object({
    type: z.literal("world"),
    world: worldStateSchema,
    serverTime: z.number().optional(),
  }),
  z.object({
    type: z.literal("self"),
    invulnerableUntil: z.number().optional(),
    vengeance: vengeanceSchema.nullable().optional(),
    hunted: huntedSchema.nullable().optional(),
    posX: z.number().optional(),
    posY: z.number().optional(),
  }),
  z.object({
    type: z.literal("death"),
    death: deathInfoSchema,
  }),
  z.object({
    type: z.literal("player_update"),
    player: playerUpdateSchema,
  }),
  z.object({
    type: z.literal("teleport_complete"),
    x: z.number().optional(),
    y: z.number().optional(),
  }),
  z.object({
    type: z.literal("exit_ready"),
  }),
  z.object({
    type: z.literal("sector_kill_flash"),
    killerName: z.string().optional(),
    victimName: z.string().optional(),
  }),
  z.object({
    type: z.literal("player_shot_result"),
    attackerUserId: z.number().optional(),
    victimUserId: z.number().optional(),
    attackerX: z.number().optional(),
    attackerY: z.number().optional(),
  }),
]);

export type SocketMessage = z.infer<typeof socketMessageSchema>;

// ─── Outgoing (client -> server) message schemas ─────────────────────────────
export const outgoingUpdateBodySchema = z.object({
  type: z.literal("update"),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  health: z.number(),
  maxHealth: z.number(),
  level: z.number(),
  shipChoice: z.string().nullable(),
  firingAt: z.number().nullable(),
});
export type OutgoingUpdateBodySchema = z.infer<typeof outgoingUpdateBodySchema>;

export const pickupCollectPayloadSchema = z.object({
  pickupId: z.number(),
});
export const asteroidDestroyPayloadSchema = z.object({
  asteroidId: z.number(),
});
export const enemyHitPayloadSchema = z.object({
  enemyId: z.number(),
  damage: z.number(),
  continuousLaser: z.boolean().optional(),
});
export const playerHitPayloadSchema = z.object({
  targetUserId: z.number(),
  damage: z.number(),
  continuousLaser: z.boolean().optional(),
});
export const skillDurationPayloadSchema = z.object({
  durationMs: z.number(),
});
export const skillGravityPitPayloadSchema = z.object({
  x: z.number(),
  y: z.number(),
  radius: z.number(),
  durationMs: z.number().optional(),
});
export const useBlackHolePayloadSchema = z.object({
  blackHoleId: z.string(),
});

export const outgoingMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update"), x: z.number(), y: z.number(), rotation: z.number(), health: z.number(), maxHealth: z.number(), level: z.number(), shipChoice: z.string().nullable(), firingAt: z.number().nullable() }),
  z.object({ type: z.literal("pickup_collect"), pickupId: z.number() }),
  z.object({ type: z.literal("asteroid_destroy"), asteroidId: z.number() }),
  z.object({ type: z.literal("enemy_hit"), enemyId: z.number(), damage: z.number(), continuousLaser: z.boolean().optional() }),
  z.object({ type: z.literal("player_hit"), targetUserId: z.number(), damage: z.number(), continuousLaser: z.boolean().optional() }),
  z.object({ type: z.literal("skill_immunity"), durationMs: z.number() }),
  z.object({ type: z.literal("skill_healing"), durationMs: z.number() }),
  z.object({ type: z.literal("skill_fury"), durationMs: z.number() }),
  z.object({ type: z.literal("skill_teleport"), durationMs: z.number() }),
  z.object({ type: z.literal("skill_gravity_pit"), x: z.number(), y: z.number(), radius: z.number(), durationMs: z.number().optional() }),
  z.object({ type: z.literal("use_black_hole"), blackHoleId: z.string() }),
  z.object({ type: z.literal("request_exit") }),
  z.object({ type: z.literal("disconnect") }),
  z.object({ type: z.literal("respawn") }),
  z.object({ type: z.literal("player_dead") }),
]);
export type OutgoingMessageSchema = z.infer<typeof outgoingMessageSchema>;

/**
 * Parse raw socket payload. Returns validated message or null (and optionally logs errors).
 */
export function parseSocketMessage(
  payload: unknown,
  onError?: (error: z.ZodError) => void
): SocketMessage | null {
  const result = socketMessageSchema.safeParse(payload);
  if (result.success) {
    return result.data;
  }
  if (onError) {
    onError(result.error);
  }
  return null;
}

/**
 * Validate outgoing message before sending. Returns validated payload or null.
 */
export function parseOutgoingMessage(
  type: string,
  payload: Record<string, unknown>,
  onError?: (error: z.ZodError) => void
): OutgoingMessageSchema | null {
  const full = { type, ...payload };
  const result = outgoingMessageSchema.safeParse(full);
  if (result.success) {
    return result.data;
  }
  if (onError) {
    onError(result.error);
  }
  return null;
}
