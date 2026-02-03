import type { WorldState, PhaserModule } from "./types";
import type Phaser from "phaser";
import { MONSTER_DEFS } from "./monsterDefs";
import { formatSectorDisplayName } from "./utils";

type BlackHoleEntry = {
  sprite: Phaser.Physics.Arcade.Sprite;
  label?: Phaser.GameObjects.Text;
  countdownLabel: Phaser.GameObjects.Text;
};

export type GravityPitNormalized = {
  id: string;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
  ownerUserId?: string;
};

export interface WorldSyncScene {
  add: Phaser.GameObjects.GameObjectFactory;
  physics: Phaser.Physics.Arcade.ArcadePhysics;
  tweens: Phaser.Tweens.TweenManager;
  pickups?: Phaser.Physics.Arcade.Group;
  enemies?: Phaser.Physics.Arcade.Group;
  asteroids?: Phaser.Physics.Arcade.StaticGroup;
  pickupSprites: Map<number, Phaser.Physics.Arcade.Sprite>;
  asteroidSprites: Map<number, Phaser.Physics.Arcade.Sprite>;
  enemySprites: Map<number, Phaser.Physics.Arcade.Sprite>;
  gravityPitContainers: Map<string, Phaser.GameObjects.Container>;
  blackHoleSprites: Map<string, BlackHoleEntry>;
  lastWorldSafeZone: WorldState["safeZone"];
  safeZoneMovesAt: number;
  lastWorldGravityPits: GravityPitNormalized[];
  safeZoneGraphics?: Phaser.GameObjects.Graphics;
  safeZoneId?: string;
  safeZoneTitleLabel?: Phaser.GameObjects.Text;
  safeZoneLabel?: Phaser.GameObjects.Text;
  updateEnemyHealthBar(enemy: Phaser.Physics.Arcade.Sprite): void;
  updateEnemyNameText(enemy: Phaser.Physics.Arcade.Sprite): void;
  onBlackHolePointerOver(holeData: NonNullable<WorldState["blackHoles"]>[number]): void;
  onBlackHolePointerOut(): void;
  onBlackHolesCleared(): void;
  onShowSafeZoneTooltip(): void;
  onHideSafeZoneTooltip(): void;
}

function normalizeGravityPits(
  pits: WorldState["gravityPits"]
): GravityPitNormalized[] {
  return (pits ?? []).map((p) => ({
    ...p,
    ownerUserId: p.ownerUserId != null ? String(p.ownerUserId) : undefined,
  }));
}

export function syncGravityPitGraphics(scene: WorldSyncScene): void {
  const pits = (scene.lastWorldGravityPits ?? []).filter(
    (p) => p.expiresAt > Date.now()
  );
  const seenIds = new Set<string>();
  for (const pit of pits) {
    seenIds.add(pit.id);
    let container = scene.gravityPitContainers.get(pit.id);
    if (!container) {
      container = scene.add.container(pit.x, pit.y);
      container.setDepth(5.5);
      const g = scene.add.graphics();
      g.fillStyle(0x2a0a4e, 0.5);
      g.fillCircle(0, 0, pit.radius);
      g.lineStyle(3, 0x6b21a8, 0.7);
      g.strokeCircle(0, 0, pit.radius);
      g.lineStyle(2, 0x9333ea, 0.5);
      g.strokeCircle(0, 0, pit.radius * 0.65);
      g.lineStyle(1, 0xc4b5fd, 0.4);
      g.strokeCircle(0, 0, pit.radius * 0.3);
      for (let i = 0; i < 6; i++) {
        const startAngle = (i / 6) * Math.PI * 2;
        g.fillStyle(0x5b21b6, 0.25 + (i % 2) * 0.15);
        g.slice(0, 0, pit.radius * 0.9, startAngle, startAngle + Math.PI / 3);
        g.fillPath();
      }
      container.add(g);
      scene.gravityPitContainers.set(pit.id, container);
      scene.tweens.add({
        targets: container,
        angle: 360,
        duration: 4000,
        repeat: -1,
        ease: "Linear",
      });
      scene.tweens.add({
        targets: g,
        alpha: 0.7,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    } else {
      container.setPosition(pit.x, pit.y);
    }
  }
  for (const [id, c] of scene.gravityPitContainers.entries()) {
    if (!seenIds.has(id)) {
      c.destroy();
      scene.gravityPitContainers.delete(id);
    }
  }
}

export function syncWorld(
  PhaserLib: PhaserModule,
  scene: WorldSyncScene,
  world: WorldState
): void {
  const safeZoneFromWorld = world.safeZone ?? null;
  scene.lastWorldSafeZone = safeZoneFromWorld;
  if (safeZoneFromWorld) {
    scene.safeZoneMovesAt =
      safeZoneFromWorld.movesAt ?? safeZoneFromWorld.expiresAt ?? 0;
  } else {
    scene.safeZoneMovesAt = 0;
  }
  scene.lastWorldGravityPits = normalizeGravityPits(world.gravityPits);

  if (!scene.pickups || !scene.enemies || !scene.asteroids) {
    return;
  }

  const seenPickups = new Set<number>();
  for (const pickup of world.pickups) {
    seenPickups.add(pickup.id);
    const existing = scene.pickupSprites.get(pickup.id);
    if (existing) {
      existing.setPosition(pickup.x, pickup.y);
      continue;
    }
    const texture =
      pickup.resource === "scrap" ? "pickup_scrap" : "pickup_tokens";
    const sprite = scene.pickups
      .create(pickup.x, pickup.y, texture)
      .setData("resource", pickup.resource)
      .setData("id", pickup.id);
    sprite.setScale(pickup.resource === "tokens" ? 0.85 : 0.8);
    sprite.setImmovable(true);
    scene.tweens.add({
      targets: sprite,
      y: sprite.y - 8,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    scene.pickupSprites.set(pickup.id, sprite);
  }
  for (const [id, sprite] of scene.pickupSprites.entries()) {
    if (!seenPickups.has(id)) {
      sprite.destroy();
      scene.pickupSprites.delete(id);
    }
  }

  const seenAsteroids = new Set<number>();
  for (const asteroid of world.asteroids) {
    seenAsteroids.add(asteroid.id);
    const existing = scene.asteroidSprites.get(asteroid.id);
    if (existing) {
      existing.setPosition(asteroid.x, asteroid.y);
      if (
        existing.scaleX !== asteroid.scale ||
        existing.scaleY !== asteroid.scale
      ) {
        existing.setScale(asteroid.scale);
        const radius =
          Math.max(existing.displayWidth, existing.displayHeight) * 0.35;
        const body = existing.body as Phaser.Physics.Arcade.Body | null;
        if (body) {
          body.setCircle(radius);
          body.setOffset(
            existing.displayWidth / 2 - radius,
            existing.displayHeight / 2 - radius
          );
        }
      }
      existing.refreshBody();
      continue;
    }
    const sprite = scene.asteroids
      .create(asteroid.x, asteroid.y, asteroid.texture)
      .setScale(asteroid.scale) as Phaser.Physics.Arcade.Sprite;
    const radius = Math.max(sprite.displayWidth, sprite.displayHeight) * 0.35;
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setCircle(radius);
      body.setOffset(
        sprite.displayWidth / 2 - radius,
        sprite.displayHeight / 2 - radius
      );
    }
    sprite.setData("id", asteroid.id);
    sprite.refreshBody();
    scene.asteroidSprites.set(asteroid.id, sprite);
  }
  for (const [id, sprite] of scene.asteroidSprites.entries()) {
    if (!seenAsteroids.has(id)) {
      sprite.destroy();
      scene.asteroidSprites.delete(id);
    }
  }

  const seenEnemies = new Set<number>();
  for (const enemy of world.enemies) {
    seenEnemies.add(enemy.id);
    const existing = scene.enemySprites.get(enemy.id);
    if (existing) {
      existing.setPosition(enemy.x, enemy.y);
      existing.setRotation(enemy.rotation);
      existing.setDepth(enemy.y);
      if (existing.texture.key !== enemy.texture) {
        existing.setTexture(enemy.texture);
        const animKey = MONSTER_DEFS[enemy.texture]?.animKey;
        if (animKey) {
          existing.play(animKey);
        } else {
          existing.anims?.stop();
        }
      }
      existing.setData("level", enemy.level);
      existing.setData("damage", enemy.damage);
      existing.setData("health", enemy.health);
      existing.setData("maxHealth", enemy.maxHealth);
      scene.updateEnemyHealthBar(existing);
      scene.updateEnemyNameText(existing);
      continue;
    }
    const sprite = scene.enemies
      .create(enemy.x, enemy.y, enemy.texture)
      .setScale(
        enemy.texture.startsWith("enemy_")
          ? 0.95
          : enemy.texture === "mob_keeper20"
            ? 0.62
            : 0.8
      ) as Phaser.Physics.Arcade.Sprite;
    sprite.setCollideWorldBounds(true);
    const radius = Math.max(sprite.displayWidth, sprite.displayHeight) * 0.35;
    const enemyBody = sprite.body as Phaser.Physics.Arcade.Body;
    enemyBody.setCircle(radius);
    enemyBody.setOffset(
      sprite.displayWidth / 2 - radius,
      sprite.displayHeight / 2 - radius
    );
    sprite.setData("id", enemy.id);
    sprite.setData("level", enemy.level);
    sprite.setData("damage", enemy.damage);
    sprite.setData("health", enemy.health);
    sprite.setData("maxHealth", enemy.maxHealth);
    const bar = scene.add.graphics();
    sprite.setData("healthBar", bar);
    const nameText = scene.add.text(sprite.x, sprite.y, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffffff",
    });
    nameText.setOrigin(0.5, 1);
    sprite.setData("nameText", nameText);
    sprite.setRotation(enemy.rotation);
    sprite.setDepth(enemy.y);
    const animKey = MONSTER_DEFS[enemy.texture]?.animKey;
    if (animKey) {
      sprite.play(animKey);
    } else {
      sprite.anims?.stop();
    }
    scene.updateEnemyHealthBar(sprite);
    scene.updateEnemyNameText(sprite);
    scene.enemySprites.set(enemy.id, sprite);
  }
  for (const [id, sprite] of scene.enemySprites.entries()) {
    if (!seenEnemies.has(id)) {
      const bar = sprite.getData(
        "healthBar"
      ) as Phaser.GameObjects.Graphics | undefined;
      bar?.destroy();
      const nameText = sprite.getData(
        "nameText"
      ) as Phaser.GameObjects.Text | undefined;
      nameText?.destroy();
      sprite.destroy();
      scene.enemySprites.delete(id);
    }
  }

  scene.lastWorldGravityPits = normalizeGravityPits(world.gravityPits);
  syncGravityPitGraphics(scene);

  const holes: NonNullable<WorldState["blackHoles"]> = world.blackHoles ?? [];
  const seenIds = new Set<string>();
  for (const bh of holes) {
    seenIds.add(bh.id);
    let entry = scene.blackHoleSprites.get(bh.id);
    const tintHex =
      typeof bh.targetColor === "string" &&
      /^#?[0-9a-fA-F]{6}$/.test(bh.targetColor)
        ? parseInt(bh.targetColor.replace("#", ""), 16)
        : null;
    if (!entry) {
      const sprite = scene.physics.add
        .sprite(bh.x, bh.y, "black_hole_1")
        .setDepth(6);
      sprite.setScale(1.5);
      sprite.setAlpha(tintHex != null ? 0.9 : 0.75);
      sprite.play("blackHolePulse");
      if (tintHex != null) sprite.setTint(tintHex);
      else sprite.clearTint();
      sprite.setData("holeData", bh);
      scene.tweens.add({
        targets: sprite,
        scale: 1.7,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      scene.tweens.add({
        targets: sprite,
        angle: 360,
        duration: 4000,
        repeat: -1,
        ease: "Linear",
      });
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerover", () => {
        scene.onBlackHolePointerOver(sprite.getData("holeData"));
      });
      sprite.on("pointerout", () => {
        scene.onBlackHolePointerOut();
      });
      let label: Phaser.GameObjects.Text | undefined;
      if (bh.targetSectorName) {
        const textObj = scene.add
          .text(
            bh.x,
            bh.y - 78,
            formatSectorDisplayName(bh.targetSectorName),
            {
              fontFamily: "Arial",
              fontSize: "12px",
              color: bh.targetColor ?? "#ffffff",
            }
          )
          .setOrigin(0.5, 1);
        textObj.setShadow(0, 2, "#000000", 4, true, true);
        textObj.setDepth(7);
        label = textObj;
      }
      const initialRemaining = Math.max(
        0,
        Math.floor((bh.expiresAt - Date.now()) / 1000)
      );
      const countdownLabel = scene.add
        .text(bh.x, bh.y - 95, `Закроется: ${initialRemaining} с`, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#b0b0b0",
        })
        .setOrigin(0.5, 1);
      countdownLabel.setShadow(0, 1, "#000000", 3, true, true);
      countdownLabel.setDepth(7);
      entry = { sprite, label, countdownLabel };
      scene.blackHoleSprites.set(bh.id, entry);
    } else {
      entry.sprite.setPosition(bh.x, bh.y);
      entry.sprite.setData("holeData", bh);
      if (entry.label) {
        entry.label.setPosition(bh.x, bh.y - 78);
      }
      entry.countdownLabel.setPosition(bh.x, bh.y - 95);
    }
  }
  for (const [id, entry] of scene.blackHoleSprites.entries()) {
    if (!seenIds.has(id)) {
      entry.sprite.destroy();
      entry.label?.destroy();
      entry.countdownLabel.destroy();
      scene.blackHoleSprites.delete(id);
    }
  }
  if (scene.blackHoleSprites.size === 0) {
    scene.onBlackHolesCleared();
  }

  const zone = scene.lastWorldSafeZone;
  if (zone) {
    if (!scene.safeZoneGraphics || scene.safeZoneId !== zone.id) {
      scene.safeZoneGraphics?.destroy();
      scene.safeZoneTitleLabel?.destroy();
      scene.safeZoneLabel?.destroy();
      scene.onHideSafeZoneTooltip();
      scene.safeZoneGraphics = scene.add.graphics();
      scene.safeZoneId = zone.id;
      scene.safeZoneMovesAt = zone.movesAt ?? zone.expiresAt;
      const colorHex =
        typeof zone.color === "string" &&
        /^#?[0-9a-fA-F]{6}$/.test(zone.color)
          ? parseInt(zone.color.replace("#", ""), 16)
          : 0x2ecc71;
      scene.safeZoneGraphics.fillStyle(colorHex, 0.08);
      scene.safeZoneGraphics.fillCircle(zone.x, zone.y, zone.radius);
      scene.safeZoneGraphics.lineStyle(3, colorHex, 0.55);
      scene.safeZoneGraphics.strokeCircle(zone.x, zone.y, zone.radius);
      scene.safeZoneGraphics.setDepth(5);
      scene.safeZoneTitleLabel = scene.add
        .text(zone.x, zone.y - zone.radius - 28, "Безопасная зона", {
          fontFamily: "Arial",
          fontSize: "13px",
          color: zone.color ?? "#2ecc71",
        })
        .setOrigin(0.5, 1);
      scene.safeZoneTitleLabel.setShadow(0, 2, "#000000", 4, true, true);
      scene.safeZoneTitleLabel.setDepth(6);
      const initialRemaining = Math.max(
        0,
        Math.floor((zone.expiresAt - Date.now()) / 1000)
      );
      scene.safeZoneLabel = scene.add
        .text(zone.x, zone.y - zone.radius - 10, `${initialRemaining} с`, {
          fontFamily: "Arial",
          fontSize: "12px",
          color: zone.color ?? "#2ecc71",
        })
        .setOrigin(0.5, 1);
      scene.safeZoneLabel.setShadow(0, 2, "#000000", 4, true, true);
      scene.safeZoneGraphics.setInteractive({
        hitArea: new PhaserLib.Geom.Circle(zone.x, zone.y, zone.radius),
        hitAreaCallback: PhaserLib.Geom.Circle.Contains,
        useHandCursor: true,
      });
      scene.safeZoneGraphics.on("pointerover", () =>
        scene.onShowSafeZoneTooltip()
      );
      scene.safeZoneGraphics.on("pointerout", () =>
        scene.onHideSafeZoneTooltip()
      );
    } else if (scene.safeZoneGraphics) {
      scene.safeZoneMovesAt = zone.movesAt ?? zone.expiresAt;
      if (scene.safeZoneTitleLabel) {
        scene.safeZoneTitleLabel.setPosition(
          zone.x,
          zone.y - zone.radius - 28
        );
      }
      if (scene.safeZoneLabel) {
        scene.safeZoneLabel.setPosition(
          zone.x,
          zone.y - zone.radius - 10
        );
      }
      scene.safeZoneGraphics.setInteractive({
        hitArea: new PhaserLib.Geom.Circle(zone.x, zone.y, zone.radius),
        hitAreaCallback: PhaserLib.Geom.Circle.Contains,
        useHandCursor: true,
      });
    }
  } else {
    scene.safeZoneGraphics?.destroy();
    scene.safeZoneGraphics = undefined;
    scene.safeZoneTitleLabel?.destroy();
    scene.safeZoneTitleLabel = undefined;
    scene.safeZoneLabel?.destroy();
    scene.safeZoneLabel = undefined;
    scene.onHideSafeZoneTooltip();
    scene.safeZoneId = undefined;
    scene.safeZoneMovesAt = 0;
  }
}
