import type { WebSocket } from "ws";

export interface PresenceEntry {
  userId: number;
  nickname: string | null;
  shipChoice: string | null;
  x: number;
  y: number;
  rotation: number;
  health: number;
  maxHealth: number;
  firingAt: number | null;
  updatedAt: number;
  lastSavedAt: number;
  invulnerableUntil: number;
  level: number;
  isDead: boolean;
  sectorId: string;
  wasInSafeZone: boolean;
  vengeanceTargetUserId?: number;
  vengeanceExpiresAt?: number;
  huntedByUserId?: number;
  huntedExpiresAt?: number;
  furyExpiresAt?: number;
  lastFuryRegenAt?: number;
  lastSafeZoneRegenAt?: number;
  healingExpiresAt?: number;
  lastHealingRegenAt?: number;
  movementSpeedMultiplier?: number;
}

export interface SectorConfig {
  level: number;
  color: string;
  namePrefix: string;
  width: number;
  height: number;
  enemyMinLevel: number;
  enemyMaxLevel: number;
  enemyTextures: string[];
  asteroidTextures: { big: string[]; small: string[] };
  pvpAllowed: boolean;
  blackHoleSpawnWeight: number;
}

export interface SectorWorld {
  seed: number;
  pickups: Map<number, { id: number; resource: string; x: number; y: number; amount?: number }>;
  enemies: Map<number, EnemyState>;
  asteroids: Map<number, AsteroidState>;
  blackHoles: BlackHoleState[];
  safeZone: SafeZoneState | null;
  lastSafeZoneMoveAt: number;
  gravityPits: GravityPitState[];
  nextPickupId: number;
  nextEnemyId: number;
  nextAsteroidId: number;
}

export interface EnemyState {
  id: number;
  x: number;
  y: number;
  rotation: number;
  level: number;
  texture: string;
  health: number;
  maxHealth: number;
  damage: number;
  spawnX: number;
  spawnY: number;
  roamTargetX: number;
  roamTargetY: number;
  nextRoamAt: number;
  updatedAt: number;
}

export interface AsteroidState {
  id: number;
  x: number;
  y: number;
  texture: string;
  scale: number;
}

export interface BlackHoleState {
  id: string;
  x: number;
  y: number;
  type: string;
  targetSectorId: string;
  targetSectorName: string;
  targetLevel: number;
  targetColor: string;
  targetTitle?: string;
  /** Вероятность появления этого титула (грейда) в %, 0–100. */
  targetGradeProbabilityPercent?: number;
  /** Минимальный уровень игрока для входа в сектор назначения. */
  targetRequiredPlayerLevel?: number;
  appearsAt?: number;
  expiresAt: number;
}

export interface SafeZoneState {
  id: string;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  color: string;
}

export interface GravityPitState {
  id: string;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  ownerUserId?: number;
}

export interface Sector {
  id: string;
  /** Тир сектора (1–5). */
  level: number;
  /** Грейд/цвет (1=белый, 2=зелёный, 3=жёлтый, 4=фиолетовый, 5=золотой). */
  grade: number;
  name: string;
  config: SectorConfig;
  world: SectorWorld;
  createdAt: number;
}

export interface GameSocket extends WebSocket {
  userId?: number;
  sectorId?: string;
  user?: { id: number; nickname: string | null; shipChoice: string | null };
}

export interface ChatMessage {
  id: string;
  userId: number;
  nickname: string;
  text: string;
  createdAt: number;
  targetUserId?: number | null;
}
