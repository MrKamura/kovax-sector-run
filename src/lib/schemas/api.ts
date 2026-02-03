import { z } from "zod";
import { RESOURCE_KEYS } from "@/lib/gameDefaults";

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authLoginBodySchema = z.object({
  email: z.string().min(1, "Email required").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, "Password required"),
});
export type AuthLoginBodySchema = z.infer<typeof authLoginBodySchema>;

export const authRegisterBodySchema = z.object({
  email: z.string().min(1, "Email required").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(4, "Password at least 4 characters"),
});
export type AuthRegisterBodySchema = z.infer<typeof authRegisterBodySchema>;

export const authUserSchema = z.object({
  id: z.number(),
  email: z.string(),
  nickname: z.string().nullable(),
  shipChoice: z.string().nullable(),
});
export type AuthUserSchema = z.infer<typeof authUserSchema>;

export const authSuccessResponseSchema = z.object({
  user: authUserSchema,
});
export type AuthSuccessResponseSchema = z.infer<typeof authSuccessResponseSchema>;

export const authErrorResponseSchema = z.object({
  error: z.string(),
});
export type AuthErrorResponseSchema = z.infer<typeof authErrorResponseSchema>;

// ─── User / Player (session) ────────────────────────────────────────────────
export const userWithVolumeSchema = authUserSchema.extend({
  musicVolume: z.number().optional(),
  sfxVolume: z.number().optional(),
});
export type UserWithVolumeSchema = z.infer<typeof userWithVolumeSchema>;

export const resourcesSchema = z.object({
  scrap: z.number(),
  tokens: z.number(),
});
export type ResourcesSchema = z.infer<typeof resourcesSchema>;

export const weaponSchema = z.object({
  id: z.string(),
  name: z.string(),
  power: z.number(),
});
export type WeaponSchema = z.infer<typeof weaponSchema>;

export const monsterProgressEntrySchema = z.object({
  level: z.number(),
  exp: z.number(),
  expToNext: z.number(),
  health: z.number(),
  maxHealth: z.number(),
  damage: z.number(),
});
export type MonsterProgressEntrySchema = z.infer<typeof monsterProgressEntrySchema>;

export const playerResponseSchema = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  name: z.string(),
  resources: resourcesSchema,
  health: z.number(),
  maxHealth: z.number(),
  level: z.number(),
  exp: z.number(),
  expToNext: z.number(),
  damage: z.number(),
  skills: z.array(z.string()),
  lastHealthAt: z.string().nullable(),
  posX: z.number(),
  posY: z.number(),
  rotation: z.number(),
  lastPositionAt: z.string().nullable(),
  shelterLevel: z.number(),
  weapons: z.array(weaponSchema),
  blueprints: z.array(z.string()),
  cosmetics: z.array(z.string()),
  lastCollectedAt: z.string().nullable(),
  monsterProgress: z.record(z.string(), monsterProgressEntrySchema).optional(),
}).passthrough();
export type PlayerResponseSchema = z.infer<typeof playerResponseSchema>;

export const sessionResponseSchema = z.object({
  player: playerResponseSchema,
  user: userWithVolumeSchema,
});
export type SessionResponseSchema = z.infer<typeof sessionResponseSchema>;

// ─── Collect ─────────────────────────────────────────────────────────────────
export const collectBodySchema = z.object({
  resource: z.enum([RESOURCE_KEYS[0], RESOURCE_KEYS[1]]),
});
export type CollectBodySchema = z.infer<typeof collectBodySchema>;

export const collectSuccessResponseSchema = z.object({
  player: playerResponseSchema,
});
export type CollectSuccessResponseSchema = z.infer<typeof collectSuccessResponseSchema>;

// ─── Damage player ──────────────────────────────────────────────────────────
export const damagePlayerBodySchema = z.object({
  amount: z.number().min(0),
});
export type DamagePlayerBodySchema = z.infer<typeof damagePlayerBodySchema>;

export const damagePlayerSuccessResponseSchema = z.object({
  player: playerResponseSchema,
  death: z.object({
    lostTokens: z.number(),
    lostExp: z.number(),
  }).optional(),
});
export type DamagePlayerSuccessResponseSchema = z.infer<typeof damagePlayerSuccessResponseSchema>;

// ─── Skills ──────────────────────────────────────────────────────────────────
export const skillAddBodySchema = z.object({
  skill: z.string().min(1).max(40),
});
export type SkillAddBodySchema = z.infer<typeof skillAddBodySchema>;

export const skillSetSlotsBodySchema = z.object({
  skills: z.array(z.string().transform((s) => String(s).trim().slice(0, 40))),
});
export type SkillSetSlotsBodySchema = z.infer<typeof skillSetSlotsBodySchema>;

export const skillsSuccessResponseSchema = z.object({
  player: playerResponseSchema,
});
export type SkillsSuccessResponseSchema = z.infer<typeof skillsSuccessResponseSchema>;

// ─── User nickname ───────────────────────────────────────────────────────────
export const userNicknameBodySchema = z.object({
  nickname: z.string().min(3, "Nickname at least 3 characters").transform((s) => s.trim()),
});
export type UserNicknameBodySchema = z.infer<typeof userNicknameBodySchema>;

// ─── User ship ───────────────────────────────────────────────────────────────
const ALLOWED_SHIPS = ["keeper19", "keeper20"] as const;
export const userShipBodySchema = z.object({
  ship: z.enum(ALLOWED_SHIPS),
});
export type UserShipBodySchema = z.infer<typeof userShipBodySchema>;

// ─── Craft ──────────────────────────────────────────────────────────────────
export const recipeIdSchema = z.enum(["rusty_blade", "scrap_spear"]);
export type RecipeIdSchema = z.infer<typeof recipeIdSchema>;

export const craftBodySchema = z.object({
  recipeId: recipeIdSchema,
});
export type CraftBodySchema = z.infer<typeof craftBodySchema>;

export const craftSuccessResponseSchema = z.object({
  player: playerResponseSchema,
});
export type CraftSuccessResponseSchema = z.infer<typeof craftSuccessResponseSchema>;

// ─── Consume energy ─────────────────────────────────────────────────────────
export const consumeEnergyBodySchema = z.object({
  amount: z.number().min(0).optional(),
});
export type ConsumeEnergyBodySchema = z.infer<typeof consumeEnergyBodySchema>;

// ─── Common API error ───────────────────────────────────────────────────────
export const apiErrorResponseSchema = z.object({
  error: z.string(),
});
export type ApiErrorResponseSchema = z.infer<typeof apiErrorResponseSchema>;
