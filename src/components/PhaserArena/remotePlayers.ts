import type Phaser from "phaser";
import type { WorldState } from "./types";
import { MOVE_SPEED, REMOTE_INTERPOLATION_DELAY } from "./constants";
import {
  getShipTexture,
  getShipScale,
  getShipIdleAnim,
  getShipSpeedMultiplier,
  getSkinRotationOffset,
} from "./playerHelpers";

export type RemoteSnapshotEntry = {
  x: number;
  y: number;
  rotation: number;
  health: number;
  maxHealth: number;
  invulnerableUntil?: number;
  firingAt: number | null;
  updatedAt: number;
  nickname: string | null;
  shipChoice: string | null;
  level: number;
};

export type QueueRemoteSnapshotEntry = {
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
};

export type UpsertRemotePlayerEntry = {
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
  huntedExpiresAt?: number;
  isHunted?: boolean;
};

export type RemotePlayerEntry = {
  sprite: Phaser.Physics.Arcade.Sprite;
  nameText: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Graphics;
  lastFiringAt: number;
  huntedExpiresAt?: number;
};

/** Context for queueRemoteSnapshot */
export interface QueueRemoteSnapshotContext {
  remoteSnapshots: Map<number, RemoteSnapshotEntry[]>;
  otherPlayers: Map<number, RemotePlayerEntry>;
  lastCorrectiveShotByAttacker: Map<number, number>;
  spawnRemoteLaser(sprite: Phaser.Physics.Arcade.Sprite, userId: number): void;
}

/** Context for upsertRemotePlayer */
export interface UpsertRemotePlayerContext {
  add: Phaser.GameObjects.GameObjectFactory;
  physics: Phaser.Physics.Arcade.ArcadePhysics;
  otherPlayersGroup: Phaser.Physics.Arcade.Group | undefined;
  otherPlayers: Map<number, RemotePlayerEntry>;
  formatPilotName(nickname: string | null | undefined, level?: number): string;
  updateRemoteHealthBar(
    bar: Phaser.GameObjects.Graphics,
    sprite: Phaser.Physics.Arcade.Sprite,
    health: number,
    maxHealth: number
  ): void;
}

/** Context for interpolateRemotePlayers */
export interface InterpolateRemotePlayersContext {
  getServerTimeOffset(): number;
  remoteSnapshots: Map<number, RemoteSnapshotEntry[]>;
  otherPlayers: Map<number, RemotePlayerEntry>;
  lastWorldSafeZone: WorldState["safeZone"];
  isInsideSafeZone(zone: WorldState["safeZone"], x: number, y: number): boolean;
  formatPilotName(nickname: string | null | undefined, level?: number): string;
  updateRemoteHealthBar(
    bar: Phaser.GameObjects.Graphics,
    sprite: Phaser.Physics.Arcade.Sprite,
    health: number,
    maxHealth: number
  ): void;
  /** Phaser.Math and Phaser.Math.Angle for interpolation */
  Phaser: typeof Phaser;
}

export function updateRemoteHealthBar(
  PhaserLib: typeof Phaser,
  bar: Phaser.GameObjects.Graphics,
  sprite: Phaser.Physics.Arcade.Sprite,
  health: number,
  maxHealth: number
): void {
  const ratio = PhaserLib.Math.Clamp(health / maxHealth, 0, 1);
  const width = 46;
  const height = 6;
  const x = sprite.x - width / 2;
  const y = sprite.y - sprite.displayHeight * 0.6 - 10;
  bar.clear();
  bar.fillStyle(0x0f141b, 0.85);
  bar.fillRoundedRect(x, y, width, height, 3);
  bar.fillStyle(0x35d06a, 1);
  bar.fillRoundedRect(x + 1.5, y + 1.5, (width - 3) * ratio, height - 3, 2);
  bar.lineStyle(1, 0x0b1a0f, 0.9);
  bar.strokeRoundedRect(x, y, width, height, 3);
  bar.setDepth(sprite.depth + 2);
}

export function queueRemoteSnapshot(
  context: QueueRemoteSnapshotContext,
  entry: QueueRemoteSnapshotEntry
): void {
  const buffer = context.remoteSnapshots.get(entry.userId) ?? [];
  buffer.push({
    x: entry.x,
    y: entry.y,
    rotation: entry.rotation,
    health: entry.health,
    maxHealth: entry.maxHealth,
    invulnerableUntil: Number(entry.invulnerableUntil ?? 0),
    firingAt: entry.firingAt,
    updatedAt: entry.updatedAt,
    nickname: entry.nickname,
    shipChoice: entry.shipChoice,
    level: entry.level ?? 1,
  });
  buffer.sort((a, b) => a.updatedAt - b.updatedAt);
  while (buffer.length > 20) {
    buffer.shift();
  }
  context.remoteSnapshots.set(entry.userId, buffer);
  const remote = context.otherPlayers.get(entry.userId);
  if (remote && entry.firingAt && entry.firingAt > remote.lastFiringAt) {
    remote.lastFiringAt = entry.firingAt;
    const lastCorrective = context.lastCorrectiveShotByAttacker.get(entry.userId);
    if (!lastCorrective || Date.now() - lastCorrective > 400) {
      context.spawnRemoteLaser(remote.sprite, entry.userId);
    }
  }
}

export function upsertRemotePlayer(
  context: UpsertRemotePlayerContext,
  entry: UpsertRemotePlayerEntry
): void {
  const isHunted =
    entry.isHunted === true ||
    (typeof entry.huntedExpiresAt === "number" && entry.huntedExpiresAt > Date.now());
  const nameColor = isHunted ? "#e74c3c" : "#b9c4d6";
  const existing = context.otherPlayers.get(entry.userId);
  if (!existing) {
    const sprite = context.physics.add
      .sprite(entry.x, entry.y, getShipTexture(entry.shipChoice))
      .setScale(getShipScale(entry.shipChoice))
      .setCollideWorldBounds(true);
    sprite.setDamping(true);
    sprite.setDrag(0.9);
    sprite.setMaxVelocity(MOVE_SPEED * getShipSpeedMultiplier(entry.shipChoice));
    sprite.setDepth(entry.y);
    sprite.setRotation(entry.rotation + getSkinRotationOffset(entry.shipChoice));
    sprite.setData("userId", entry.userId);
    context.otherPlayersGroup?.add(sprite);
    sprite.setAlpha(
      Number(entry.invulnerableUntil ?? 0) > Date.now() ? 0.55 : 1
    );
    sprite.play(getShipIdleAnim(entry.shipChoice));
    sprite.setData("aimRotation", entry.rotation);
    const nameText = context.add
      .text(entry.x, entry.y - 68, context.formatPilotName(entry.nickname, entry.level), {
        fontFamily: "Arial",
        fontSize: "12px",
        color: nameColor,
      })
      .setOrigin(0.5, 1);
    const healthBar = context.add.graphics();
    context.otherPlayers.set(entry.userId, {
      sprite,
      nameText,
      healthBar,
      lastFiringAt: 0,
      huntedExpiresAt: entry.huntedExpiresAt,
    });
    sprite.setData("shipChoice", entry.shipChoice ?? null);
    context.updateRemoteHealthBar(healthBar, sprite, entry.health, entry.maxHealth);
  } else {
    existing.nameText.setText(context.formatPilotName(entry.nickname, entry.level));
    existing.nameText.setColor(nameColor);
    existing.huntedExpiresAt = entry.huntedExpiresAt;
    const expectedTexture = getShipTexture(entry.shipChoice);
    if (existing.sprite.texture.key !== expectedTexture) {
      existing.sprite.setTexture(expectedTexture);
      existing.sprite.play(getShipIdleAnim(entry.shipChoice));
    }
    existing.sprite.setData("shipChoice", entry.shipChoice ?? null);
    existing.sprite.setData("aimRotation", entry.rotation);
  }
}

export function interpolateRemotePlayers(
  context: InterpolateRemotePlayersContext
): void {
  const PhaserLib = context.Phaser;
  const renderTime =
    Date.now() + context.getServerTimeOffset() - REMOTE_INTERPOLATION_DELAY;
  for (const [userId, remote] of context.otherPlayers.entries()) {
    const buffer = context.remoteSnapshots.get(userId);
    if (!buffer || buffer.length === 0) {
      continue;
    }
    while (buffer.length >= 2 && buffer[1].updatedAt <= renderTime) {
      buffer.shift();
    }
    const snapshotA = buffer[0];
    const snapshotB = buffer.length > 1 ? buffer[1] : null;
    let x = snapshotA.x;
    let y = snapshotA.y;
    let rotation = snapshotA.rotation;
    let health = snapshotA.health;
    let maxHealth = snapshotA.maxHealth;
    let invulnerableUntil = snapshotA.invulnerableUntil ?? 0;
    if (snapshotB) {
      const span = snapshotB.updatedAt - snapshotA.updatedAt;
      const alpha = span > 0 ? (renderTime - snapshotA.updatedAt) / span : 0;
      const t = PhaserLib.Math.Clamp(alpha, 0, 1);
      x = PhaserLib.Math.Linear(snapshotA.x, snapshotB.x, t);
      y = PhaserLib.Math.Linear(snapshotA.y, snapshotB.y, t);
      const delta = PhaserLib.Math.Angle.Wrap(
        snapshotB.rotation - snapshotA.rotation
      );
      rotation = snapshotA.rotation + delta * t;
      health = PhaserLib.Math.Linear(snapshotA.health, snapshotB.health, t);
      maxHealth = snapshotB.maxHealth;
      invulnerableUntil = snapshotB.invulnerableUntil ?? invulnerableUntil;
    }
    remote.sprite.setPosition(x, y);
    const zone = context.lastWorldSafeZone;
    const zoneActive = zone && (zone.expiresAt ?? 0) > Date.now();
    const remoteInSafeZone =
      zoneActive && context.isInsideSafeZone(zone, x, y);
    remote.sprite.setAlpha(
      remoteInSafeZone ? 0.35 : invulnerableUntil > Date.now() ? 0.55 : 1
    );
    const remoteChoice = remote.sprite.getData("shipChoice") as
      | string
      | null
      | undefined;
    remote.sprite.setRotation(
      rotation + getSkinRotationOffset(remoteChoice)
    );
    remote.sprite.setData("aimRotation", rotation);
    remote.sprite.setDepth(y);
    remote.nameText.setPosition(x, y - 68);
    const nickname = snapshotB?.nickname ?? snapshotA.nickname ?? "Пилот";
    const level = snapshotB?.level ?? snapshotA.level ?? 1;
    remote.nameText.setText(context.formatPilotName(nickname, level));
    context.updateRemoteHealthBar(remote.healthBar, remote.sprite, health, maxHealth);
  }
}
