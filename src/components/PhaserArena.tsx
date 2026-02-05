import { useGameStore } from "@/store/gameStore";
import {
  MOVE_SPEED,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  FURY_SIZE_MULT,
  SPAWN_IMMUNITY_UNTIL_FIRST_ACTION,
} from "./PhaserArena/constants";
import type { PhaserModule, WorldState } from "./PhaserArena/types";
import { MONSTER_DEFS } from "./PhaserArena/monsterDefs";
import {
  formatSectorDisplayName,
  monsterNameColor,
} from "./PhaserArena/utils";
import { ASSETS } from "./PhaserArena/assets";
import {
  getShipTexture,
  getShipScale,
  getShipIdleAnim,
  getShipBlindAnim,
  getShipAttackAnim,
  getShipSpeedMultiplier,
  getLevelScale,
  getLevelSpeedMultiplier,
  getSkinRotationOffset,
} from "./PhaserArena/playerHelpers";
import {
  setupMobileControls,
  type MobileControlsState,
} from "./PhaserArena/mobileControls";
import { createSpaceArenaAnimations } from "./PhaserArena/animations";
import {
  createAudioManager,
  type AudioManager,
  type AudioManagerState,
} from "./PhaserArena/audio";
import {
  syncWorld as doSyncWorld,
  syncGravityPitGraphics,
  type GravityPitNormalized,
  type WorldSyncScene,
} from "./PhaserArena/worldSync";
import {
  connectSocket as connectSocketFromModule,
  handlePresencePayload as handlePresencePayloadFromModule,
  handleWorldPayload as handleWorldPayloadFromModule,
  sendWorldAction as sendWorldActionFromModule,
  type PresenceEntry,
  type PresencePayloadContext,
  type WorldPayloadContext,
} from "./PhaserArena/socketHandlers";
import {
  queueRemoteSnapshot as queueRemoteSnapshotFromModule,
  upsertRemotePlayer as upsertRemotePlayerFromModule,
  updateRemoteHealthBar as updateRemoteHealthBarFromModule,
  interpolateRemotePlayers as interpolateRemotePlayersFromModule,
  type QueueRemoteSnapshotContext,
  type UpsertRemotePlayerContext,
  type InterpolateRemotePlayersContext,
} from "./PhaserArena/remotePlayers";
import { parseSocketMessage } from "./PhaserArena/socketSchemas";

const createSpaceArenaScene = (
  Phaser: PhaserModule,
  collectResource: (resource: "scrap" | "tokens") => void,
  consumeEnergy: () => void,
  damagePlayer: (amount: number) => void
) => {
  return class SpaceArenaScene extends Phaser.Scene {
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd?: {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
    };
    private player?: Phaser.Physics.Arcade.Sprite;
    private pickups?: Phaser.Physics.Arcade.Group;
    private pickupSprites = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private asteroids?: Phaser.Physics.Arcade.StaticGroup;
    private asteroidSprites = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private background?: Phaser.GameObjects.TileSprite;
    private lasers?: Phaser.Physics.Arcade.Group;
    private enemies?: Phaser.Physics.Arcade.Group;
    private enemySprites = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private spaceKey?: Phaser.Input.Keyboard.Key;
    private skillKeys?: Phaser.Input.Keyboard.Key[];
    private lastContinuousLaserAt = 0;
    private lastContinuousLaserHitAt = 0;
    /** Prism-style fan of beams (multiple Graphics) */
    private continuousLaserBeams: Phaser.GameObjects.Graphics[] = [];
    private otherPlayers = new Map<
      number,
      {
        sprite: Phaser.Physics.Arcade.Sprite;
        nameText: Phaser.GameObjects.Text;
        healthBar: Phaser.GameObjects.Graphics;
        lastFiringAt: number;
        huntedExpiresAt?: number;
      }
    >();
    private otherPlayersGroup?: Phaser.Physics.Arcade.Group;
    private remoteLasers?: Phaser.Physics.Arcade.Group;
    private remoteSnapshots = new Map<
      number,
      Array<{
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
      }>
    >();
    private lastFiringAt = 0;
    private lastSentAt = 0;
    private appliedServerPosition = false;
    /** When we spawn a corrective laser (from server shot_result), skip presence-based laser for this attacker briefly */
    private lastCorrectiveShotByAttacker = new Map<number, number>();
    /** Last remote laser we spawned per shooter (so victim can destroy the wrong one when player_shot_result arrives) */
    private lastRemoteLaserByShooter = new Map<
      number,
      { laser: Phaser.Physics.Arcade.Image; at: number }
    >();
    private socket?: WebSocket;
    private socketShouldReconnect = true;
    private serverTimeOffset = 0;
    private playerPulse?: Phaser.Tweens.Tween;
    private playerFacing: "n" | "s" | "e" | "w" = "s";
    private audioManager!: AudioManager;
    private unsubscribeMusicVolume?: () => void;
    private unsubscribeShipChoice?: () => void;
    private health = 100;
    private maxHealth = 100;
    private healthBar?: Phaser.GameObjects.Graphics;
    private playerNameText?: Phaser.GameObjects.Text;
    private fpsText?: Phaser.GameObjects.Text;
    private lastDamageAt = 0;
    private invulnerableUntil = 0;
    private invulnerableText?: Phaser.GameObjects.Text;
    private speedBuffText?: Phaser.GameObjects.Text;
    private healingBuffText?: Phaser.GameObjects.Text;
    private furyBuffText?: Phaser.GameObjects.Text;
    private teleportCastText?: Phaser.GameObjects.Text;
    private teleportChannelGraphics?: Phaser.GameObjects.Graphics;
    private keyboardCaptureDisabled = false;
    private deathNotified = false;
    private blackHoleSprites = new Map<
      string,
      {
        sprite: Phaser.Physics.Arcade.Sprite;
        label?: Phaser.GameObjects.Text;
        countdownLabel: Phaser.GameObjects.Text;
      }
    >();
    private blackHoleTooltip?: Phaser.GameObjects.Text;
    private hoveredBlackHoleData: NonNullable<WorldState["blackHoles"]>[number] | null = null;
    private safeZoneId?: string;
    private safeZoneMovesAt = 0; // server timestamp (ms) when zone will relocate
    private safeZoneGraphics?: Phaser.GameObjects.Graphics;
    private levelUpEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    private furyFlameEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private safeZoneTitleLabel?: Phaser.GameObjects.Text;
    private safeZoneLabel?: Phaser.GameObjects.Text;
    private safeZoneTooltip?: Phaser.GameObjects.Text;
    private lastWorldSafeZone: WorldState["safeZone"] = null;
    private gravityPitContainers = new Map<string, Phaser.GameObjects.Container>();
    private lastWorldGravityPits: GravityPitNormalized[] = [];
    private lowHealthVignette?: Phaser.GameObjects.Graphics;
    private lastLowHealthShakeAt = 0;
    private lastHeartbeatAt = 0;
    private lowHealthBarPulseTween?: Phaser.Tweens.Tween;
    private static readonly LOW_HEALTH_THRESHOLD = 0.25;
    private static readonly LOW_HEALTH_SPEED_BOOST = 1.12;
    private lastHoleUseAt = 0;
    private sectorText?: Phaser.GameObjects.Text;
    private currentSectorId?: string;
    /** 1 = green sectors, 2 = yellow; used to pick main music track */
    private currentSectorLevel = 1;
    private lastExitCountdownTickAt = 0;

    // Mobile controls (virtual joystick + fire button)
    private mobileState: MobileControlsState = {
      enabled: false,
      joystickX: 0,
      joystickY: 0,
      fireHeld: false,
      fireJustPressed: false,
      fireRepeatMs: 160,
    };
    private playerSpeedMultiplier = 1;
    private aimRotation = 0;
    private appliedLevelScale = 1;

    constructor() {
      super({ key: "SpaceArenaScene" });
    }

    preload() {
      for (const asset of ASSETS) {
        if (asset.type === "image") {
          this.load.image(asset.key, asset.url);
        } else {
          this.load.spritesheet(asset.key, asset.url, {
            frameWidth: asset.frameWidth,
            frameHeight: asset.frameHeight,
          });
        }
      }
    }

    create() {
      if (!this.textures.exists("levelup_particle")) {
        const g = this.make.graphics(undefined, false);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture("levelup_particle", 8, 8);
        g.destroy();
      }
      if (!this.textures.exists("fury_flame")) {
        const g = this.make.graphics(undefined, false);
        g.fillStyle(0xff4400, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture("fury_flame", 8, 8);
        g.destroy();
      }
      this.furyFlameEmitter = this.add.particles(0, 0, "fury_flame", {
        speed: { min: 20, max: 70 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 0 },
        lifespan: 400,
        tint: [0xff2200, 0xff6600, 0xffaa00, 0xff4400],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 40,
        emitting: false,
      });
      this.furyFlameEmitter.setDepth(8);
      this.background = this.add
        .tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, "space_bg")
        .setOrigin(0);

      this.add
        .text(24, 16, "Космический сектор", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#d9c7a7",
        })
        .setScrollFactor(0);
      this.add
        .text(24, 38, "WASD/стрелки — маневрирование", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#97a0ae",
        })
        .setScrollFactor(0);
      this.fpsText = this.add
        .text(24, 58, "FPS: --", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#7f8b9a",
        })
        .setPadding({ x: 8, y: 4 })
        .setBackgroundColor("rgba(0,0,0,0.55)")
        .setScrollFactor(0);

      createSpaceArenaAnimations(this);
      this.sectorText = this.add
        .text(24, 78, "Сектор: --", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#9fd9b2",
        })
        .setScrollFactor(0);
      this.invulnerableText = this.add
        .text(0, 0, "", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#7ed8ff",
        })
        .setPadding({ x: 8, y: 4 })
        .setBackgroundColor("rgba(0,0,0,0.55)")
        .setOrigin(0.5, 1);
      this.speedBuffText = this.add
        .text(0, 0, "", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#b8e986",
        })
        .setPadding({ x: 8, y: 4 })
        .setBackgroundColor("rgba(0,0,0,0.55)")
        .setOrigin(0.5, 1);
      this.healingBuffText = this.add
        .text(0, 0, "", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#7ed8ff",
        })
        .setPadding({ x: 8, y: 4 })
        .setBackgroundColor("rgba(0,0,0,0.55)")
        .setOrigin(0.5, 1);
      this.furyBuffText = this.add
        .text(0, 0, "", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#e85a3a",
        })
        .setPadding({ x: 8, y: 4 })
        .setBackgroundColor("rgba(0,0,0,0.55)")
        .setOrigin(0.5, 1);
      this.teleportCastText = this.add
        .text(0, 0, "", {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#b794f6",
        })
        .setPadding({ x: 8, y: 4 })
        .setBackgroundColor("rgba(0,0,0,0.55)")
        .setOrigin(0.5, 1);
      this.healthBar = this.add.graphics().setDepth(10);
      this.updateHealthBar();
      const user = useGameStore.getState().user;
      const initialLevel = useGameStore.getState().player?.level ?? 1;
      this.playerNameText = this.add
        .text(0, 0, this.formatPilotName(user?.nickname ?? "", initialLevel), {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#e7e3d8",
        })
        .setOrigin(0.5, 1);

      this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      const camera = this.cameras.main;
      camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      const centerX = WORLD_WIDTH / 2;
      const centerY = WORLD_HEIGHT / 2;

      this.asteroids = this.physics.add.staticGroup();

      const playerState = useGameStore.getState().player;
      const spawnFromServer = !!playerState?.lastPositionAt;
      const spawnX = spawnFromServer ? playerState.posX : centerX;
      const spawnY = spawnFromServer ? playerState.posY : centerY;
      const spawnRotation = spawnFromServer ? playerState.rotation : 0;
      this.appliedServerPosition = spawnFromServer;
      const shipTexture = getShipTexture(user?.shipChoice);
      this.player = this.physics.add
        .sprite(spawnX, spawnY, shipTexture)
        .setScale(
          getShipScale(user?.shipChoice) *
            getLevelScale(useGameStore.getState().player?.level ?? 1)
        )
        .setCollideWorldBounds(true);
      // Spawn immunity: invulnerable until first movement (prevents mobs killing on login).
      this.invulnerableUntil = SPAWN_IMMUNITY_UNTIL_FIRST_ACTION;
      this.playerSpeedMultiplier =
        getShipSpeedMultiplier(user?.shipChoice) *
        getLevelSpeedMultiplier(useGameStore.getState().player?.level ?? 1);
      this.appliedLevelScale = getLevelScale(useGameStore.getState().player?.level ?? 1);
      this.aimRotation = spawnRotation;
      this.player.setRotation(
        spawnRotation + getSkinRotationOffset(user?.shipChoice)
      );
      this.player.play(getShipIdleAnim(user?.shipChoice));
      this.player.setDamping(true);
      this.player.setDrag(0.92);
      this.player.setMaxVelocity(MOVE_SPEED * this.playerSpeedMultiplier);
      const shipRadius =
        Math.max(this.player.displayWidth, this.player.displayHeight) * 0.35;
      const shipBody = this.player.body as Phaser.Physics.Arcade.Body;
      shipBody.setCircle(shipRadius);
      shipBody.setOffset(
        this.player.displayWidth / 2 - shipRadius,
        this.player.displayHeight / 2 - shipRadius
      );

      camera.startFollow(this.player, true, 0.08, 0.08);
      camera.setDeadzone(this.scale.width * 0.3, this.scale.height * 0.3);

      this.pickups = this.physics.add.group();

      this.cursors = this.input.keyboard?.createCursorKeys();
      this.wasd = this.input.keyboard?.addKeys({
        up: "W",
        down: "S",
        left: "A",
        right: "D",
      }) as SpaceArenaScene["wasd"];
      this.spaceKey = this.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );
      if (this.input.keyboard) {
        const keyCodes = [
          Phaser.Input.Keyboard.KeyCodes.ONE,
          Phaser.Input.Keyboard.KeyCodes.TWO,
          Phaser.Input.Keyboard.KeyCodes.THREE,
          Phaser.Input.Keyboard.KeyCodes.FOUR,
          Phaser.Input.Keyboard.KeyCodes.FIVE,
          Phaser.Input.Keyboard.KeyCodes.SIX,
          Phaser.Input.Keyboard.KeyCodes.SEVEN,
          Phaser.Input.Keyboard.KeyCodes.EIGHT,
          Phaser.Input.Keyboard.KeyCodes.NINE,
        ];
        this.skillKeys = keyCodes.map((code) => this.input.keyboard!.addKey(code));
      }

      this.lasers = this.physics.add.group();
      this.remoteLasers = this.physics.add.group();
      this.enemies = this.physics.add.group();
      this.otherPlayersGroup = this.physics.add.group();
      this.audioManager = createAudioManager({
        getState: (): AudioManagerState => useGameStore.getState(),
        getCurrentSectorLevel: () => this.currentSectorLevel,
        setCurrentSectorLevel: (level) => {
          this.currentSectorLevel = level;
        },
      });
      const unlockAudio = () => this.audioManager.unlockAudio();
      this.input.once("pointerdown", unlockAudio);
      this.input.keyboard?.once("keydown", unlockAudio);
      window.addEventListener("pointerdown", unlockAudio, { once: true });
      window.addEventListener("keydown", unlockAudio, { once: true });
      this.events.once("shutdown", () => this.audioManager.stopMusic());
      this.events.once("destroy", () => this.audioManager.stopMusic());
      this.events.once("shutdown", this.clearPresence, this);
      this.events.once("destroy", this.clearPresence, this);

      this.unsubscribeMusicVolume = useGameStore.subscribe((state) => {
        this.audioManager.updateVolumes(state);
      });
      this.unsubscribeShipChoice = useGameStore.subscribe((state, prev) => {
        const prevChoice = prev?.user?.shipChoice;
        const nextChoice = state.user?.shipChoice;
        if (nextChoice && nextChoice !== prevChoice) {
          this.applyPlayerMonsterChoice(nextChoice);
        }
      });

      this.physics.add.overlap(
        this.player,
        this.pickups,
        (_player, pickup) => {
          // While immune, you cannot collect items.
          if (this.isInvulnerable()) {
            return;
          }
          const pickupSprite = pickup as Phaser.Physics.Arcade.Sprite;
          if (pickupSprite.getData("collected")) {
            return;
          }
          pickupSprite.setData("collected", true);
          const resource = pickupSprite.getData("resource") as
            | "scrap"
            | "tokens";
          const pickupId = pickupSprite.getData("id") as number | undefined;
          pickupSprite.destroy();
          this.audioManager.playPickupSound();
          if (resource === "tokens") {
            if (pickupId != null) {
              this.sendWorldAction("pickup_collect", {
                pickupId,
                resource,
              });
            }
          } else {
            void collectResource(resource);
            if (pickupId != null) {
              this.sendWorldAction("pickup_collect", {
                pickupId,
                resource,
              });
            }
          }
        }
      );

      this.physics.add.collider(this.player, this.asteroids);
      // Asteroids are obstacles only (no damage).
      this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
        if (this.isInvulnerable()) {
          return;
        }
        // Safe zone: mobs do not damage players inside the zone.
        const zone = this.lastWorldSafeZone;
        if (zone && zone.expiresAt > Date.now()) {
          const dx = this.player!.x - zone.x;
          const dy = this.player!.y - zone.y;
          if (Math.hypot(dx, dy) <= zone.radius) {
            return;
          }
        }
        this.audioManager.playEnemyAttackSound();
        const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        const enemyDamage =
          (enemySprite.getData("damage") as number | undefined) ?? 8;
        this.applyPlayerDamage(enemyDamage, damagePlayer);
      });
      this.physics.add.collider(this.lasers, this.asteroids, (_laser, asteroid) => {
        const laser = _laser as Phaser.Physics.Arcade.Image;
        laser.destroy();
        const asteroidSprite = asteroid as Phaser.Physics.Arcade.Sprite;
        const asteroidId = asteroidSprite.getData("id") as number | undefined;
        if (asteroidId != null) {
          this.sendWorldAction("asteroid_destroy", { asteroidId });
        }
        this.audioManager.playExplosionSound();
      });
      this.physics.add.overlap(this.lasers, this.enemies, (_laser, enemy) => {
        const laser = _laser as Phaser.Physics.Arcade.Image;
        laser.destroy();
        const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
        const enemyId = enemySprite.getData("id") as number | undefined;
        if (enemyId != null) {
          const damage =
            useGameStore.getState().player?.damage ?? 18;
          this.sendWorldAction("enemy_hit", { enemyId, damage });
        }
        this.audioManager.playEnemyHitSound();
      });

      // PvP: local lasers can hit other players (server validates sector/immunity/damage).
      this.physics.add.overlap(this.lasers, this.otherPlayersGroup, (_laser, other) => {
        const laser = _laser as Phaser.Physics.Arcade.Image;
        laser.destroy();
        const otherSprite = other as Phaser.Physics.Arcade.Sprite;
        const targetUserId = otherSprite.getData("userId") as number | undefined;
        if (targetUserId != null) {
          const damage = useGameStore.getState().player?.damage ?? 12;
          this.sendWorldAction("player_hit", { targetUserId, damage });
        }
        this.audioManager.playEnemyHitSound();
      });

      // Remote lasers (from other players) stop when they hit the local player — no fly-through.
      this.physics.add.overlap(this.remoteLasers, this.player, (_laser) => {
        const laser = _laser as Phaser.Physics.Arcade.Image;
        if (laser.active) laser.destroy();
      });

      this.connectSocket();
      this.time.addEvent({
        delay: 60,
        loop: true,
        callback: this.publishPresence,
        callbackScope: this,
      });

      setupMobileControls(this, this.mobileState, () =>
        this.isChatInputFocused()
      );
    }
    private updateHealthBar() {
      if (!this.healthBar) {
        return;
      }
      const barWidth = 140;
      const barHeight = 8;
      const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
      const isLowHealth = this.maxHealth > 0 && this.health / this.maxHealth < SpaceArenaScene.LOW_HEALTH_THRESHOLD;
      const fillColor = isLowHealth ? 0xcc3333 : 0x35d06a;
      const strokeColor = isLowHealth ? 0x8b2020 : 0x0b1a0f;
      const x = -barWidth / 2;
      const y = -barHeight / 2;
      this.healthBar.clear();
      this.healthBar.fillStyle(0x0f141b, 0.9);
      this.healthBar.fillRoundedRect(x, y, barWidth, barHeight, 4);
      this.healthBar.fillStyle(fillColor, 1);
      this.healthBar.fillRoundedRect(
        x + 2,
        y + 2,
        (barWidth - 4) * ratio,
        barHeight - 4,
        3
      );
      this.healthBar.lineStyle(1, strokeColor, 0.9);
      this.healthBar.strokeRoundedRect(x, y, barWidth, barHeight, 4);
    }

    private applyPlayerDamage(amount: number, damagePlayerAction: (amount: number) => void) {
      if (this.isInvulnerable()) {
        return;
      }
      if (this.health <= 0) {
        return;
      }
      const now = this.time.now;
      if (now - this.lastDamageAt < 150) {
        return;
      }
      this.lastDamageAt = now;
      // Fury (rage) mode: cannot die, health floors at 1
      const furyEffect = useGameStore.getState().activeSkillEffect;
      const furyActive =
        furyEffect?.skillId === "fury_7s" &&
        (furyEffect?.expiresAt ?? 0) > Date.now();
      const minHealth = furyActive ? 1 : 0;
      const newHealth = Math.max(minHealth, this.health - amount);
      const actualDamage = this.health - newHealth;
      this.health = newHealth;
      this.updateHealthBar();
      this.audioManager.playShipHitSound();
      this.cameras.main.shake(120, 0.004);
      void damagePlayerAction(actualDamage);
    }

    private playTeleportOutEffect(x: number, y: number) {
      const g = this.add.graphics();
      g.fillStyle(0xb794f6, 0.6);
      g.fillCircle(x, y, 28);
      g.setDepth((this.player?.depth ?? 0) + 2);
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 180,
        ease: "Power2",
        onComplete: () => g.destroy(),
      });
    }

    private playTeleportInEffect(x: number, y: number) {
      const g = this.add.graphics();
      g.setDepth((this.player?.depth ?? 0) + 2);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 400,
        ease: "Power2",
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const p = tween.progress;
          const r = 8 + p * 32;
          const a = 0.8 * (1 - p);
          g.clear();
          g.fillStyle(0xb794f6, a);
          g.fillCircle(x, y, r);
        },
        onComplete: () => g.destroy(),
      });
    }

    private triggerLevelUpEffects(_celebration: { level: number; previousLevel: number }) {
      this.audioManager.playLevelUpFanfare();
      const cx = this.cameras.main.scrollX + this.cameras.main.width / 2;
      const cy = this.cameras.main.scrollY + this.cameras.main.height / 2;
      const colors = [0xffd700, 0xffaa00, 0xff6b00, 0xff4444, 0x44ff88];
      this.levelUpEmitters.forEach((e) => e.destroy());
      this.levelUpEmitters = [];
      for (let i = 0; i < 5; i++) {
        const angleDeg = (i / 5) * 360 + 90;
        const emitter = this.add.particles(cx, cy, "levelup_particle", {
          speed: { min: 80, max: 180 },
          angle: { min: angleDeg - 25, max: angleDeg + 25 },
          scale: { start: 0.4, end: 0 },
          lifespan: 1200,
          tint: colors[i % colors.length],
          blendMode: Phaser.BlendModes.ADD,
          quantity: 18,
          emitting: false,
        });
        emitter.setDepth(100);
        this.levelUpEmitters.push(emitter);
        emitter.explode(18);
        const j = i;
        this.time.delayedCall(200 + j * 80, () => {
          try {
            if (emitter.scene && this.levelUpEmitters.includes(emitter)) {
              emitter.explode(12);
            }
          } catch {
            // Emitter may have been destroyed (e.g. scene exit) before callback ran.
          }
        });
      }
      this.time.delayedCall(2000, () => {
        this.levelUpEmitters.forEach((e) => e.destroy());
        this.levelUpEmitters = [];
      });
    }

    private updateEnemyHealthBar(enemy: Phaser.Physics.Arcade.Sprite) {
      const bar = enemy.getData("healthBar") as
        | Phaser.GameObjects.Graphics
        | undefined;
      if (!bar) {
        return;
      }
      const health = enemy.getData("health") as number;
      const maxHealth = enemy.getData("maxHealth") as number;
      const ratio = Phaser.Math.Clamp(health / maxHealth, 0, 1);
      const width = 46;
      const height = 6;
      const x = enemy.x - width / 2;
      const y = enemy.y - enemy.displayHeight * 0.6 - 10;
      bar.clear();
      bar.fillStyle(0x0f141b, 0.85);
      bar.fillRoundedRect(x, y, width, height, 3);
      bar.fillStyle(0x35d06a, 1);
      bar.fillRoundedRect(x + 1.5, y + 1.5, (width - 3) * ratio, height - 3, 2);
      bar.lineStyle(1, 0x0b1a0f, 0.9);
      bar.strokeRoundedRect(x, y, width, height, 3);
      bar.setDepth(enemy.depth + 2);
    }

    private updateEnemyNameText(enemy: Phaser.Physics.Arcade.Sprite) {
      const nameText = enemy.getData("nameText") as
        | Phaser.GameObjects.Text
        | undefined;
      if (!nameText) {
        return;
      }
      const level = (enemy.getData("level") as number | undefined) ?? 1;
      const textureKey = enemy.texture.key;
      const displayName = MONSTER_DEFS[textureKey]?.name ?? "Monster";
      const playerLevel = useGameStore.getState().player?.level ?? 1;
      nameText.setText(`${displayName} Lv.${level}`);
      nameText.setColor(monsterNameColor(level, playerLevel));
      nameText.setPosition(enemy.x, enemy.y - enemy.displayHeight * 0.6 - 22);
      nameText.setDepth(enemy.depth + 3);
    }

    private applySectorInfo(sector?: {
      id: string;
      name: string;
      title?: string;
      level: number;
      grade?: number;
      color: string;
      width: number;
      height: number;
      deathPenaltyPveMin?: number;
      deathPenaltyPveMax?: number;
      deathPenaltyPvpMin?: number;
      deathPenaltyPvpMax?: number;
    }) {
      if (!sector) {
        return;
      }
      const level = Math.max(1, Math.min(5, sector.level ?? 1));
      const grade = Math.max(1, Math.min(5, sector.grade ?? level));
      this.audioManager.switchMainMusicToSectorLevel(grade);
      if (this.background) {
        this.background.setSize(sector.width, sector.height);
        this.background.setDisplaySize(sector.width, sector.height);
        this.background.clearTint();
      }
      this.physics.world.setBounds(0, 0, sector.width, sector.height);
      this.cameras.main.setBounds(0, 0, sector.width, sector.height);
      if (this.sectorText) {
        const name = formatSectorDisplayName(sector.name ?? undefined);
        const titlePart = sector.title ? `, ${sector.title}` : "";
        const pveRange =
          sector.deathPenaltyPveMin != null && sector.deathPenaltyPveMax != null
            ? sector.deathPenaltyPveMin === sector.deathPenaltyPveMax
              ? `${sector.deathPenaltyPveMin}%`
              : `${sector.deathPenaltyPveMin}–${sector.deathPenaltyPveMax}%`
            : "";
        const pvpRange =
          sector.deathPenaltyPvpMin != null && sector.deathPenaltyPvpMax != null
            ? sector.deathPenaltyPvpMin === sector.deathPenaltyPvpMax
              ? `${sector.deathPenaltyPvpMin}%`
              : `${sector.deathPenaltyPvpMin}–${sector.deathPenaltyPvpMax}%`
            : "";
        const deathLine =
          pveRange || pvpRange
            ? `\nПотеря при смерти: ${[pveRange && `мобы ${pveRange}`, pvpRange && `игроки ${pvpRange}`].filter(Boolean).join(", ")}`
            : "";
        this.sectorText.setText(
          `Сектор: ${name}${titlePart} (ур. ${level})${deathLine}`
        );
        this.sectorText.setColor(sector.color ?? "#888888");
      }
      if (this.currentSectorId !== sector.id) {
        this.appliedServerPosition = false;
      }
      this.currentSectorId = sector.id;
    }

    private applyPlayerMonsterChoice(choice: string | null | undefined) {
      if (!this.player) {
        return;
      }
      const texture = getShipTexture(choice);
      if (this.player.texture.key !== texture) {
        this.player.setTexture(texture);
      }
      const level = useGameStore.getState().player?.level ?? 1;
      const levelScale = getLevelScale(level);
      this.player.setScale(getShipScale(choice) * levelScale);
      this.appliedLevelScale = levelScale;
      this.playerSpeedMultiplier =
        getShipSpeedMultiplier(choice) * getLevelSpeedMultiplier(level);
      this.player.setMaxVelocity(MOVE_SPEED * this.playerSpeedMultiplier);
      this.player.play(getShipIdleAnim(choice), true);
      this.player.setRotation(this.aimRotation + getSkinRotationOffset(choice));
      const radius =
        Math.max(this.player.displayWidth, this.player.displayHeight) * 0.35;
      const body = this.player.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        body.setCircle(radius);
        body.setOffset(
          this.player.displayWidth / 2 - radius,
          this.player.displayHeight / 2 - radius
        );
      }
    }

    private connectSocket() {
      connectSocketFromModule(
        {
          setSocket: (ws) => {
            this.socket = ws as WebSocket;
          },
          setInvulnerableUntil: (ms) => {
            this.invulnerableUntil = ms;
          },
          handleSocketMessage: (payload) => this.handleSocketMessage(payload),
          getSocketShouldReconnect: () => this.socketShouldReconnect,
        },
        {
          spawnImmunityMs: SPAWN_IMMUNITY_UNTIL_FIRST_ACTION,
          getSocketUrl: () => {
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            return `${protocol}://${window.location.host}/ws`;
          },
        }
      );
    }

    private handleSocketMessage(payload: Record<string, unknown>) {
      const msg = parseSocketMessage(payload, (err) => {
        if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
          console.warn("[Socket] Invalid message:", err.flatten());
        }
      });
      if (!msg) return;

      switch (msg.type) {
        case "presence":
          handlePresencePayloadFromModule(this as unknown as PresencePayloadContext, msg.players, msg.serverTime);
          break;
        case "world":
          handleWorldPayloadFromModule(this as unknown as WorldPayloadContext, msg.world, msg.serverTime);
          break;
        case "self": {
          this.invulnerableUntil = Number(msg.invulnerableUntil ?? 0);
          if (msg.vengeance !== undefined) {
            useGameStore.getState().setVengeance(msg.vengeance);
          }
          if (msg.hunted !== undefined) {
            useGameStore.getState().setHunted(msg.hunted);
          }
          const posX = msg.posX;
          const posY = msg.posY;
          if (posX != null && posY != null && this.player) {
            this.player.setPosition(posX, posY);
            this.appliedServerPosition = true;
            useGameStore.getState().applyPlayerUpdate({ posX, posY });
          }
          break;
        }
        case "death":
          useGameStore.getState().setDeathInfo(msg.death);
          break;
        case "player_update": {
          const player = msg.player;
          if (player.lastPositionAt) {
            this.appliedServerPosition = false;
          }
          if (typeof player.health === "number") {
            this.health = player.health;
          }
          if (typeof player.maxHealth === "number") {
            this.maxHealth = player.maxHealth;
          }
          useGameStore.getState().applyPlayerUpdate(player);
          const celebration = useGameStore.getState().levelUpCelebration;
          if (celebration) {
            this.triggerLevelUpEffects(celebration);
          }
          break;
        }
        case "teleport_complete": {
          const x = msg.x ?? NaN;
          const y = msg.y ?? NaN;
          if (this.player && Number.isFinite(x) && Number.isFinite(y)) {
            const oldX = this.player.x;
            const oldY = this.player.y;
            useGameStore.getState().setActiveSkillEffect(null);
            this.playTeleportOutEffect(oldX, oldY);
            this.player.x = x;
            this.player.y = y;
            this.playTeleportInEffect(x, y);
          }
          break;
        }
        case "exit_ready": {
          const store = useGameStore.getState();
          store.clearExitCountdown();
          this.clearPresence();
          if (store.exitThenLogout) {
            store.setExitThenLogout(false);
            void store.logout();
          }
          break;
        }
        case "sector_kill_flash": {
          const killerName = String(msg.killerName ?? "").trim() || "Пилот";
          const victimName = String(msg.victimName ?? "").trim() || "Пилот";
          useGameStore.getState().setSectorKillFlash({ killerName, victimName });
          this.time.delayedCall(2000, () => {
            useGameStore.getState().setSectorKillFlash(null);
          });
          break;
        }
        case "player_shot_result": {
          const myUserId = useGameStore.getState().user?.id ?? null;
          const victimUserId = msg.victimUserId ?? NaN;
          const attackerUserId = msg.attackerUserId ?? NaN;
          const attackerX = msg.attackerX ?? NaN;
          const attackerY = msg.attackerY ?? NaN;
          if (
            myUserId != null &&
            victimUserId === myUserId &&
            Number.isFinite(attackerUserId) &&
            Number.isFinite(attackerX) &&
            Number.isFinite(attackerY)
          ) {
            this.lastCorrectiveShotByAttacker.set(attackerUserId, Date.now());
            const wrongLaser = this.lastRemoteLaserByShooter.get(attackerUserId);
            if (wrongLaser && Date.now() - wrongLaser.at < 800 && wrongLaser.laser.active) {
              wrongLaser.laser.destroy();
            }
            this.lastRemoteLaserByShooter.delete(attackerUserId);
            this.spawnCorrectiveLaser(attackerX, attackerY, attackerUserId);
          }
          break;
        }
      }
    }

    private async publishPresence() {
      if (!this.player) {
        return;
      }
      const now = this.time.now;
      if (now - this.lastSentAt < 60) {
        return;
      }
      this.lastSentAt = now;
      const fireNow = Date.now();
      const justFired = fireNow - this.lastFiringAt < 140;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }
      this.socket.send(
        JSON.stringify({
          type: "update",
          x: this.player.x,
          y: this.player.y,
          rotation: this.aimRotation,
          health: this.health,
          maxHealth: this.maxHealth,
          level: useGameStore.getState().player?.level ?? 1,
          shipChoice: useGameStore.getState().user?.shipChoice ?? null,
          firingAt: justFired ? this.lastFiringAt : null,
        })
      );
    }

    private getServerTimeOffset(): number {
      return this.serverTimeOffset;
    }
    private setServerTimeOffset(offset: number): void {
      this.serverTimeOffset = offset;
    }
    private getSelfId(): number | undefined {
      return useGameStore.getState().user?.id;
    }
    private linear(a: number, b: number, t: number): number {
      return Phaser.Math.Linear(a, b, t);
    }

    private handlePresencePayload(players: PresenceEntry[], serverTime?: number) {
      handlePresencePayloadFromModule(this as unknown as PresencePayloadContext, players, serverTime);
    }

    private handleWorldPayload(world: WorldState, serverTime?: number) {
      handleWorldPayloadFromModule(this as unknown as WorldPayloadContext, world, serverTime);
    }

    private sendWorldAction(type: string, payload: Record<string, unknown>) {
      sendWorldActionFromModule(this.socket, type, payload);
    }

    private syncWorld(world: WorldState) {
      doSyncWorld(Phaser, this as unknown as WorldSyncScene, world);
    }

    private queueRemoteSnapshot(entry: {
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
    }) {
      const ctx: QueueRemoteSnapshotContext = {
        remoteSnapshots: this.remoteSnapshots,
        otherPlayers: this.otherPlayers,
        lastCorrectiveShotByAttacker: this.lastCorrectiveShotByAttacker,
        spawnRemoteLaser: (sprite, userId) => this.spawnRemoteLaser(sprite, userId),
      };
      queueRemoteSnapshotFromModule(ctx, entry);
    }

    private upsertRemotePlayer(entry: {
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
    }) {
      const ctx: UpsertRemotePlayerContext = {
        add: this.add,
        physics: this.physics,
        otherPlayersGroup: this.otherPlayersGroup,
        otherPlayers: this.otherPlayers,
        formatPilotName: (nickname, level) => this.formatPilotName(nickname, level),
        updateRemoteHealthBar: (bar, sprite, health, maxHealth) =>
          this.updateRemoteHealthBar(bar, sprite, health, maxHealth),
      };
      upsertRemotePlayerFromModule(ctx, entry);
    }

    private showBlackHoleTooltip() {
      this.hideBlackHoleTooltip();
      const bh = this.hoveredBlackHoleData;
      if (!bh) return;
      const sectorName = bh.targetSectorName
        ? formatSectorDisplayName(bh.targetSectorName)
        : "неизвестный сектор";
      const targetTitle = bh.targetTitle ? `, ${bh.targetTitle}` : "";
      const playerLevel = useGameStore.getState().player?.level ?? 1;
      const targetLevel = Math.max(1, Math.min(5, bh.targetLevel ?? 1));
      const requiredLevel = bh.targetRequiredPlayerLevel ?? 1;
      const accessOpen = playerLevel >= requiredLevel;
      const accessLine = accessOpen
        ? "Доступ открыт"
        : `Доступ закрыт: нужен ${requiredLevel} уровень.`;
      const lines = [
        `Чёрная дыра — портал в сектор ${sectorName}${targetTitle} (ур. ${targetLevel}).`,
        accessLine,
      ];
      this.blackHoleTooltip = this.add
        .text(bh.x, bh.y - 100, lines.join("\n"), {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#e0e0e0",
          align: "center",
          wordWrap: { width: 220 },
        })
        .setOrigin(0.5, 1);
      this.blackHoleTooltip.setShadow(0, 1, "#000000", 3, true, true);
      this.blackHoleTooltip.setDepth(10);
    }

    private hideBlackHoleTooltip() {
      if (this.blackHoleTooltip) {
        this.blackHoleTooltip.destroy();
        this.blackHoleTooltip = undefined;
      }
    }

    private showSafeZoneTooltip() {
      this.hideSafeZoneTooltip();
      if (!this.lastWorldSafeZone) return;
      const zone = this.lastWorldSafeZone;
      const name = "Безопасная зона";
      const description =
        "Внутри вас не атакуют враги и другие игроки. Ускоренная регенерация здоровья.";
      const lines = [name, description];
      this.safeZoneTooltip = this.add
        .text(zone.x, zone.y - zone.radius - 50, lines.join("\n\n"), {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#e0e0e0",
          align: "center",
          wordWrap: { width: 240 },
        })
        .setOrigin(0.5, 1);
      this.safeZoneTooltip.setShadow(0, 1, "#000000", 3, true, true);
      this.safeZoneTooltip.setDepth(10);
    }

    private hideSafeZoneTooltip() {
      if (this.safeZoneTooltip) {
        this.safeZoneTooltip.destroy();
        this.safeZoneTooltip = undefined;
      }
    }

    onBlackHolePointerOver(
      holeData: NonNullable<WorldState["blackHoles"]>[number]
    ) {
      this.hoveredBlackHoleData = holeData;
      this.showBlackHoleTooltip();
    }
    onBlackHolePointerOut() {
      this.hoveredBlackHoleData = null;
      this.hideBlackHoleTooltip();
    }
    onBlackHolesCleared() {
      this.hoveredBlackHoleData = null;
      this.hideBlackHoleTooltip();
    }
    onShowSafeZoneTooltip() {
      this.showSafeZoneTooltip();
    }
    onHideSafeZoneTooltip() {
      this.hideSafeZoneTooltip();
    }

    private clearPresence() {
      this.socketShouldReconnect = false;
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: "disconnect" }));
        } catch {
          // ignore send failures
        }
      }
      try {
        this.socket?.close();
      } catch {
        // ignore close failures
      }
      this.socket = undefined;
      for (const remote of this.otherPlayers.values()) {
        remote.sprite.destroy();
        remote.nameText.destroy();
        remote.healthBar.destroy();
      }
      this.otherPlayers.clear();
      this.remoteSnapshots.clear();
      for (const pickup of this.pickupSprites.values()) {
        pickup.destroy();
      }
      this.pickupSprites.clear();
      for (const asteroid of this.asteroidSprites.values()) {
        asteroid.destroy();
      }
      this.asteroidSprites.clear();
      for (const enemy of this.enemySprites.values()) {
        const bar = enemy.getData(
          "healthBar"
        ) as Phaser.GameObjects.Graphics | undefined;
        bar?.destroy();
        const levelText = enemy.getData(
          "levelText"
        ) as Phaser.GameObjects.Text | undefined;
        levelText?.destroy();
        enemy.destroy();
      }
      this.enemySprites.clear();
      for (const [, entry] of this.blackHoleSprites) {
        entry.sprite.destroy();
        entry.label?.destroy();
        entry.countdownLabel.destroy();
      }
      this.blackHoleSprites.clear();
      this.hoveredBlackHoleData = null;
      this.hideBlackHoleTooltip();
      this.safeZoneGraphics?.destroy();
      this.safeZoneGraphics = undefined;
      this.safeZoneTitleLabel?.destroy();
      this.safeZoneTitleLabel = undefined;
      this.safeZoneLabel?.destroy();
      this.safeZoneLabel = undefined;
      this.hideSafeZoneTooltip();
      this.safeZoneId = undefined;
      for (const c of this.gravityPitContainers.values()) {
        c.destroy();
      }
      this.gravityPitContainers.clear();
      this.safeZoneMovesAt = 0;
      this.lastWorldSafeZone = null;
      if (this.lowHealthVignette) {
        this.lowHealthVignette.destroy();
        this.lowHealthVignette = undefined;
      }
      if (this.lowHealthBarPulseTween) {
        this.lowHealthBarPulseTween.remove();
        this.lowHealthBarPulseTween = undefined;
      }
      this.audioManager.stopLowHealthMusic();
      useGameStore.getState().setLowHealthActive(false);
      if (this.unsubscribeMusicVolume) {
        this.unsubscribeMusicVolume();
        this.unsubscribeMusicVolume = undefined;
      }
      if (this.unsubscribeShipChoice) {
        this.unsubscribeShipChoice();
        this.unsubscribeShipChoice = undefined;
      }
    }

    private updateRemoteHealthBar(
      bar: Phaser.GameObjects.Graphics,
      sprite: Phaser.Physics.Arcade.Sprite,
      health: number,
      maxHealth: number
    ) {
      updateRemoteHealthBarFromModule(Phaser, bar, sprite, health, maxHealth);
    }

    private spawnRemoteLaser(sprite: Phaser.Physics.Arcade.Sprite, shooterUserId?: number) {
      if (!this.remoteLasers) {
        return;
      }
      const laser = this.remoteLasers.create(
        sprite.x,
        sprite.y,
        "laser_blue"
      ) as Phaser.Physics.Arcade.Image;
      const aimRotation =
        (sprite.getData("aimRotation") as number | undefined) ?? sprite.rotation;
      const shipChoice =
        (sprite.getData("shipChoice") as string | null | undefined) ?? null;
      const tint = shipChoice === "keeper20" ? 0xffa500 : 0xff3b3b;
      laser.setRotation(aimRotation);
      laser.setScale(0.7);
      laser.setTint(tint);
      const angle = aimRotation - Math.PI / 2;
      const laserBody = laser.body as Phaser.Physics.Arcade.Body;
      this.physics.velocityFromRotation(angle, 520, laserBody.velocity);
      if (shooterUserId != null) {
        const prev = this.lastRemoteLaserByShooter.get(shooterUserId);
        if (prev?.laser.active) prev.laser.destroy();
        this.lastRemoteLaserByShooter.set(shooterUserId, { laser, at: Date.now() });
      }
      this.time.delayedCall(1200, () => {
        laser.destroy();
        if (shooterUserId != null) {
          const cur = this.lastRemoteLaserByShooter.get(shooterUserId);
          if (cur?.laser === laser) this.lastRemoteLaserByShooter.delete(shooterUserId);
        }
      });
    }

    /** Spawn a laser from server-authoritative attacker position toward local player (so victim sees it hit). */
    private spawnCorrectiveLaser(attackerX: number, attackerY: number, attackerUserId: number) {
      if (!this.remoteLasers || !this.player) {
        return;
      }
      const dx = this.player.x - attackerX;
      const dy = this.player.y - attackerY;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 520;
      // Spawn most of the way along the path so the laser reaches the player in ~50–80ms and visibly hits
      const spawnAlong = 0.88;
      const startX = attackerX + dx * spawnAlong;
      const startY = attackerY + dy * spawnAlong;
      const laser = this.remoteLasers.create(
        startX,
        startY,
        "laser_blue"
      ) as Phaser.Physics.Arcade.Image;
      const remote = this.otherPlayers.get(attackerUserId);
      const tint = remote?.sprite.getData("shipChoice") === "keeper20" ? 0xffa500 : 0xff3b3b;
      laser.setScale(0.7);
      laser.setTint(tint);
      const laserBody = laser.body as Phaser.Physics.Arcade.Body;
      laserBody.velocity.x = (dx / dist) * speed;
      laserBody.velocity.y = (dy / dist) * speed;
      const angle = Math.atan2(dy, dx) + Math.PI / 2;
      laser.setRotation(angle);
      this.time.delayedCall(1200, () => laser.destroy());
    }

    update() {
      if (!this.player) {
        return;
      }

      // Process pending server skill effects first so they are always sent (even when chat focused or early return).
      const store = useGameStore.getState();
      const pending = store.pendingServerSkillEffect;
      if (pending && this.socket?.readyState === WebSocket.OPEN) {
        if (pending.skillId === "immunity_5s") {
          this.sendWorldAction("skill_immunity", { durationMs: pending.durationMs });
          this.invulnerableUntil = Date.now() + pending.durationMs;
        } else if (pending.skillId === "healing_5s") {
          this.sendWorldAction("skill_healing", { durationMs: pending.durationMs });
        } else if (pending.skillId === "fury_7s") {
          this.sendWorldAction("skill_fury", { durationMs: pending.durationMs });
        } else if (pending.skillId === "teleport_3s") {
          this.sendWorldAction("skill_teleport", { durationMs: pending.durationMs });
        } else if (pending.skillId === "gravity_pit") {
          // Place pit at player position so it appears where they activated it
          const x = Math.round(this.player.x);
          const y = Math.round(this.player.y);
          this.sendWorldAction("skill_gravity_pit", {
            durationMs: pending.durationMs,
            x,
            y,
          });
          // Optimistic pit: show zone at same position
          const radius = 180;
          const myUserId = useGameStore.getState().user?.id ?? null;
          const optimisticPit = {
            id: `opt-gp-${Date.now()}`,
            x,
            y,
            radius,
            expiresAt: Date.now() + (pending.durationMs || 5000),
            ownerUserId: myUserId != null ? String(myUserId) : undefined,
          };
          this.lastWorldGravityPits = [...(this.lastWorldGravityPits || []), optimisticPit];
          syncGravityPitGraphics(this as unknown as WorldSyncScene);
        }
        store.setPendingServerSkillEffect(null);
      }

      // Safe exit: when user clicked Exit, send request_exit once and start countdown.
      if (store.exitRequested && this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: "request_exit" }));
        } catch {
          // ignore
        }
        store.onExitRequestSent();
      }
      // Tick exit countdown every second (server will send exit_ready and close after 5 sec).
      const exitCountdown = store.exitCountdown;
      if (typeof exitCountdown === "number" && exitCountdown >= 0) {
        const now = Date.now();
        if (now - this.lastExitCountdownTickAt >= 1000) {
          this.lastExitCountdownTickAt = now;
          const next = Math.max(0, exitCountdown - 1);
          store.setExitCountdown(next);
        }
      }

      // Safe zone: update store so skills are disabled when inside; make local player translucent.
      const zone = this.lastWorldSafeZone;
      const zoneActive = zone && (zone.expiresAt ?? 0) > Date.now();
      const inSafeZone =
        zoneActive && this.isInsideSafeZone(zone, this.player.x, this.player.y);
      store.setPlayerInSafeZone(!!inSafeZone);
      // Visual: translucent in safe zone (so other players can't see clearly), or when invulnerable.
      this.player.setAlpha(
        inSafeZone ? 0.35 : this.isInvulnerable() ? 0.55 : 1
      );

      // Safe-zone countdown: remaining seconds until the zone relocates (moves to new position).
      if (this.safeZoneLabel && this.safeZoneMovesAt > 0) {
        const remaining = this.safeZoneMovesAt - Date.now();
        const seconds = Math.max(0, Math.floor(remaining / 1000));
        this.safeZoneLabel.setText(`${seconds} с`);
      }
      // Black hole countdown: remaining seconds until each portal closes.
      for (const [, entry] of this.blackHoleSprites) {
        const holeData = entry.sprite.getData("holeData") as { expiresAt: number } | undefined;
        if (holeData?.expiresAt) {
          const remaining = holeData.expiresAt - Date.now();
          const seconds = Math.max(0, Math.floor(remaining / 1000));
          entry.countdownLabel.setText(`Закроется: ${seconds} с`);
        }
      }

      const chatFocused = this.isChatInputFocused();
      const exiting = typeof store.exitCountdown === "number";
      if (chatFocused && !this.keyboardCaptureDisabled) {
        this.input.keyboard?.disableGlobalCapture();
        if (this.input.keyboard) {
          this.input.keyboard.enabled = false;
        }
        this.keyboardCaptureDisabled = true;
      }
      if (!chatFocused && this.keyboardCaptureDisabled) {
        this.input.keyboard?.enableGlobalCapture();
        if (this.input.keyboard) {
          this.input.keyboard.enabled = true;
        }
        this.keyboardCaptureDisabled = false;
      }

      // During exit countdown: no control, stop movement, minimal update only (player cannot move into mobs and die).
      if (chatFocused || exiting) {
        this.player.setVelocity(0, 0);
        this.interpolateRemotePlayers();
        this.player.setDepth(this.player.y);
        this.enemies?.children.iterate((enemy) => {
          const sprite = enemy as Phaser.Physics.Arcade.Sprite;
          if (!sprite?.active) {
            return true;
          }
          sprite.setDepth(sprite.y);
          this.updateEnemyHealthBar(sprite);
          this.updateEnemyNameText(sprite);
          return true;
        });
        if (this.healthBar) {
          this.healthBar.setPosition(this.player.x, this.player.y - 60);
          this.healthBar.setDepth(this.player.depth + 3);
          this.updateHealthBar();
        }
        if (this.playerNameText) {
          const nickname = useGameStore.getState().user?.nickname ?? "";
          this.playerNameText.setText(nickname);
          this.playerNameText.setPosition(this.player.x, this.player.y - 68);
          this.playerNameText.setDepth(this.player.depth + 4);
        }
        if (this.fpsText) {
          this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
        }
        if (this.invulnerableText) {
          const remaining = this.invulnerableUntil - Date.now();
          if (remaining > 0) {
            const label =
              remaining >= SPAWN_IMMUNITY_UNTIL_FIRST_ACTION / 2
                ? "Невосприимчивость: до первого действия"
                : `Невосприимчивость: ${(remaining / 1000).toFixed(1)} сек.`;
            this.invulnerableText.setText(label);
            this.invulnerableText.setPosition(this.player.x, this.player.y - 86);
            this.invulnerableText.setDepth(this.player.depth + 5);
          } else {
            this.invulnerableText.setText("");
          }
        }
        if (this.speedBuffText) {
          const speedEffect = useGameStore.getState().activeSkillEffect;
          const speedActive =
            speedEffect?.skillId === "movement_speed_5s" &&
            (speedEffect?.expiresAt ?? 0) > Date.now();
          if (speedActive && speedEffect?.expiresAt) {
            const remaining = speedEffect.expiresAt - Date.now();
            const seconds = (remaining / 1000).toFixed(1);
            this.speedBuffText.setText(`Ускорение: ${seconds} сек.`);
            this.speedBuffText.setPosition(this.player.x, this.player.y - 100);
            this.speedBuffText.setDepth(this.player.depth + 5);
          } else {
            this.speedBuffText.setText("");
          }
        }
        if (this.healingBuffText) {
          const healingEffect = useGameStore.getState().activeSkillEffect;
          const healingActive =
            healingEffect?.skillId === "healing_5s" &&
            (healingEffect?.expiresAt ?? 0) > Date.now();
          if (healingActive && healingEffect?.expiresAt) {
            const remaining = healingEffect.expiresAt - Date.now();
            const seconds = (remaining / 1000).toFixed(1);
            this.healingBuffText.setText(`Лечение: ${seconds} сек.`);
            this.healingBuffText.setPosition(this.player.x, this.player.y - 114);
            this.healingBuffText.setDepth(this.player.depth + 5);
          } else {
            this.healingBuffText.setText("");
          }
        }
        if (this.furyBuffText) {
          const furyEffect = useGameStore.getState().activeSkillEffect;
          const furyActive =
            furyEffect?.skillId === "fury_7s" &&
            (furyEffect?.expiresAt ?? 0) > Date.now();
          if (furyActive && furyEffect?.expiresAt) {
            const remaining = furyEffect.expiresAt - Date.now();
            const seconds = (remaining / 1000).toFixed(1);
            this.furyBuffText.setText(`Ярость: ${seconds} сек.`);
            this.furyBuffText.setPosition(this.player.x, this.player.y - 128);
            this.furyBuffText.setDepth(this.player.depth + 5);
          } else {
            this.furyBuffText.setText("");
          }
        }
        if (this.teleportCastText) {
          const teleportEffect = useGameStore.getState().activeSkillEffect;
          const teleportCasting =
            teleportEffect?.skillId === "teleport_3s" &&
            (teleportEffect?.expiresAt ?? 0) > Date.now();
          if (teleportCasting && teleportEffect?.expiresAt) {
            const remaining = teleportEffect.expiresAt - Date.now();
            const seconds = (remaining / 1000).toFixed(1);
            this.teleportCastText.setText(`Телепорт: ${seconds} сек.`);
            this.teleportCastText.setPosition(this.player.x, this.player.y - 142);
            this.teleportCastText.setDepth(this.player.depth + 5);
            if (!this.teleportChannelGraphics) {
              this.teleportChannelGraphics = this.add.graphics().setDepth((this.player.depth ?? 0) - 1);
            }
            this.teleportChannelGraphics.clear();
            const pulse = 0.25 + 0.12 * Math.sin(Date.now() / 120);
            this.teleportChannelGraphics.fillStyle(0xb794f6, pulse);
            this.teleportChannelGraphics.fillCircle(this.player.x, this.player.y, 36);
          } else {
            this.teleportCastText.setText("");
            if (this.teleportChannelGraphics) {
              this.teleportChannelGraphics.destroy();
              this.teleportChannelGraphics = undefined;
            }
          }
        }
        if (this.furyFlameEmitter) {
          const furyEffect = useGameStore.getState().activeSkillEffect;
          const furyActive =
            furyEffect?.skillId === "fury_7s" &&
            (furyEffect?.expiresAt ?? 0) > Date.now();
          if (furyActive) {
            this.furyFlameEmitter.setPosition(this.player.x, this.player.y);
            this.furyFlameEmitter.setDepth(this.player.depth + 1);
            if (!this.furyFlameEmitter.emitting) this.furyFlameEmitter.start();
          } else if (this.furyFlameEmitter.emitting) {
            this.furyFlameEmitter.stop();
          }
        }
        return;
      }

      const playerState = useGameStore.getState().player;
      if (playerState) {
        this.health = playerState.health ?? this.health;
        this.maxHealth = playerState.maxHealth ?? this.maxHealth;
        const level = playerState.level ?? 1;
        const choice = useGameStore.getState().user?.shipChoice;
        const desiredLevelScale = getLevelScale(level);
        if (Math.abs(desiredLevelScale - this.appliedLevelScale) > 0.0001) {
          this.appliedLevelScale = desiredLevelScale;
          this.player.setScale(getShipScale(choice) * desiredLevelScale);
          this.playerSpeedMultiplier =
            getShipSpeedMultiplier(choice) *
            getLevelSpeedMultiplier(level);
          this.player.setMaxVelocity(MOVE_SPEED * this.playerSpeedMultiplier);
          // Keep aiming rotation stable; only adjust skin offset.
          this.player.setRotation(
            this.aimRotation + getSkinRotationOffset(choice)
          );
          const radius =
            Math.max(this.player.displayWidth, this.player.displayHeight) * 0.35;
          const body = this.player.body as Phaser.Physics.Arcade.Body | null;
          if (body) {
            body.setCircle(radius);
            body.setOffset(
              this.player.displayWidth / 2 - radius,
              this.player.displayHeight / 2 - radius
            );
          }
        }
        if (!this.appliedServerPosition && playerState.lastPositionAt) {
          this.player.setPosition(playerState.posX, playerState.posY);
          this.aimRotation = playerState.rotation ?? this.aimRotation;
          this.player.setRotation(
            this.aimRotation +
              getSkinRotationOffset(useGameStore.getState().user?.shipChoice)
          );
          this.appliedServerPosition = true;
        }
      }

      if (playerState && playerState.health <= 0) {
        if (
          useGameStore.getState().pendingRespawn &&
          this.socket?.readyState === WebSocket.OPEN
        ) {
          const vengeanceTarget = useGameStore.getState().vengeanceRespawnTargetUserId;
          if (vengeanceTarget != null && Number.isFinite(vengeanceTarget)) {
            this.socket.send(
              JSON.stringify({ type: "respawn_vengeance", killedByUserId: vengeanceTarget })
            );
          } else {
            this.socket.send(JSON.stringify({ type: "respawn" }));
          }
          useGameStore.getState().clearRespawnRequest();
        }
        if (!this.deathNotified && this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: "player_dead" }));
          this.deathNotified = true;
        }
        if (!this.player) {
          this.interpolateRemotePlayers();
          if (this.fpsText) {
            this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
          }
          return;
        }
        this.player.setVelocity(0, 0);
        this.player.setVisible(true);
        this.player.play(getShipBlindAnim(useGameStore.getState().user?.shipChoice), true);
        const body = this.player.body as Phaser.Physics.Arcade.Body | null;
        if (body) {
          body.enable = false;
        }
        this.interpolateRemotePlayers();
        if (this.fpsText) {
          this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
        }
        return;
      }
      if (this.deathNotified) {
        this.deathNotified = false;
        if (!this.player) return;
        this.player.setVisible(true);
        this.player.play(getShipIdleAnim(useGameStore.getState().user?.shipChoice), true);
        this.player.setScale(getShipScale(useGameStore.getState().user?.shipChoice));
        const body = this.player.body as Phaser.Physics.Arcade.Body | null;
        if (body) {
          body.enable = true;
        }
      }

      const left = this.cursors?.left.isDown || this.wasd?.left.isDown;
      const right = this.cursors?.right.isDown || this.wasd?.right.isDown;
      const up = this.cursors?.up.isDown || this.wasd?.up.isDown;
      const down = this.cursors?.down.isDown || this.wasd?.down.isDown;

      const joystickActive =
        this.mobileState.enabled &&
        (Math.abs(this.mobileState.joystickX) > 0.12 ||
          Math.abs(this.mobileState.joystickY) > 0.12);

      const movementSpeedActive =
        useGameStore.getState().activeSkillEffect?.skillId === "movement_speed_5s" &&
        (useGameStore.getState().activeSkillEffect?.expiresAt ?? 0) > Date.now();
      const movementSpeedBoost = movementSpeedActive ? 1.5 : 1;
      const myUserId = useGameStore.getState().user?.id ?? null;
      const inGravityPit = this.isInsideAnyGravityPitExcludingOwner(
        this.lastWorldGravityPits,
        this.player.x,
        this.player.y,
        myUserId != null ? String(myUserId) : null
      );
      const gravityPitFactor = inGravityPit ? 0.35 : 1;
      const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
      const inLowHealth =
        this.health > 0 && healthRatio < SpaceArenaScene.LOW_HEALTH_THRESHOLD;
      const lowHealthSpeedBoost = inLowHealth ? SpaceArenaScene.LOW_HEALTH_SPEED_BOOST : 1;

      if (this.healthBar) {
        if (inLowHealth) {
          if (!this.lowHealthBarPulseTween || !this.lowHealthBarPulseTween.isPlaying()) {
            this.lowHealthBarPulseTween?.remove();
            this.lowHealthBarPulseTween = this.tweens.add({
              targets: this.healthBar,
              scale: 1.14,
              alpha: 0.88,
              duration: 420,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }
        } else {
          if (this.lowHealthBarPulseTween) {
            this.lowHealthBarPulseTween.remove();
            this.lowHealthBarPulseTween = undefined;
          }
          this.healthBar.setScale(1);
          this.healthBar.setAlpha(1);
        }
      }

      if (!this.player) {
        return;
      }

      const body = this.player.body as Phaser.Physics.Arcade.Body | null;
      if (!body) {
        return;
      }

      this.player.setMaxVelocity(
        MOVE_SPEED * this.playerSpeedMultiplier * movementSpeedBoost * gravityPitFactor * lowHealthSpeedBoost
      );

      // Fury skill: increase keeper size for duration; restore when effect ends
      const furyActive =
        useGameStore.getState().activeSkillEffect?.skillId === "fury_7s" &&
        (useGameStore.getState().activeSkillEffect?.expiresAt ?? 0) > Date.now();
      const choice = useGameStore.getState().user?.shipChoice;
      const baseScale = getShipScale(choice) * this.appliedLevelScale;
      const furyScale = baseScale * (furyActive ? FURY_SIZE_MULT : 1);
      this.player.setScale(furyScale);
      if (body) {
        const radius =
          Math.max(this.player.displayWidth, this.player.displayHeight) * 0.35;
        body.setCircle(radius);
        body.setOffset(
          this.player.displayWidth / 2 - radius,
          this.player.displayHeight / 2 - radius
        );
      }
      // Red flame particle effect around player during Fury
      if (this.furyFlameEmitter) {
        if (furyActive) {
          this.furyFlameEmitter.setPosition(this.player.x, this.player.y);
          this.furyFlameEmitter.setDepth(this.player.depth + 1);
          if (!this.furyFlameEmitter.emitting) {
            this.furyFlameEmitter.start();
          }
        } else {
          if (this.furyFlameEmitter.emitting) {
            this.furyFlameEmitter.stop();
          }
        }
      }

      let inputX = 0;
      let inputY = 0;
      let speed = 0;

      if (joystickActive) {
        inputX = this.mobileState.joystickX;
        inputY = this.mobileState.joystickY;
        const mag = Math.min(1, Math.sqrt(inputX * inputX + inputY * inputY));
        speed = MOVE_SPEED * this.playerSpeedMultiplier * movementSpeedBoost * gravityPitFactor * lowHealthSpeedBoost * mag;
      } else {
        inputX = (right ? 1 : 0) + (left ? -1 : 0);
        inputY = (down ? 1 : 0) + (up ? -1 : 0);
        speed = MOVE_SPEED * this.playerSpeedMultiplier * movementSpeedBoost * gravityPitFactor * lowHealthSpeedBoost;
      }

      const moving = inputX !== 0 || inputY !== 0;
      if (moving) {
        const vec = new Phaser.Math.Vector2(inputX, inputY);
        if (!joystickActive) {
          vec.normalize();
        } else if (vec.length() > 1) {
          vec.normalize();
        }
        vec.scale(speed);
        this.player.setVelocity(vec.x, vec.y);
        const rotation = vec.angle() + Math.PI / 2;
        this.aimRotation = rotation;
        this.player.setRotation(
          rotation + getSkinRotationOffset(useGameStore.getState().user?.shipChoice)
        );
      } else {
        this.player.setVelocity(0, 0);
      }

      for (const [holeId, entry] of this.blackHoleSprites.entries()) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          entry.sprite.x,
          entry.sprite.y
        );
        if (dist < 70 && Date.now() - this.lastHoleUseAt > 1200) {
          this.lastHoleUseAt = Date.now();
          this.sendWorldAction("use_black_hole", { blackHoleId: holeId });
          break;
        }
      }

      const now = Date.now();
      const activeSkill = store.activeSkillEffect;
      if (activeSkill && now >= activeSkill.expiresAt) {
        store.setActiveSkillEffect(null);
      }
      if (this.skillKeys && !this.isChatInputFocused() && !this.isInvulnerable()) {
        for (let i = 0; i < this.skillKeys.length; i++) {
          if (Phaser.Input.Keyboard.JustDown(this.skillKeys[i])) {
            void store.triggerSkillSlot(i);
            break;
          }
        }
      }
      const isContinuousLaser =
        (activeSkill?.skillId === "continuous_laser" || activeSkill?.skillId === "continuous_laser_super") &&
        now < (activeSkill?.expiresAt ?? 0);
      const isSuperLaser = activeSkill?.skillId === "continuous_laser_super";

      if (!isContinuousLaser) {
        this.continuousLaserBeams.forEach((g) => g.destroy());
        this.continuousLaserBeams = [];
        this.audioManager.stopContinuousLaserSound();
      } else {
        const choice = store.user?.shipChoice;
        const tint = choice === "keeper20" ? 0xffa500 : 0xff3b3b;
        const beamAngle = this.aimRotation - Math.PI / 2;
        const beamLength = 520;
        const beamWidth = 6;
        const PRISM_SPREAD_ANGLES = [-0.35, -0.175, 0, 0.175, 0.35];
        const beamCount = isSuperLaser ? 5 : 1;
        // Recreate beams if we switched between single and super
        if (this.continuousLaserBeams.length !== beamCount) {
          this.continuousLaserBeams.forEach((g) => g.destroy());
          this.continuousLaserBeams = [];
        }
        if (this.continuousLaserBeams.length === 0) {
          for (let i = 0; i < beamCount; i++) {
            const g = this.add.graphics();
            g.fillStyle(tint, isSuperLaser ? 0.85 - i * 0.04 : 0.95);
            g.fillRect(0, -beamWidth / 2, beamLength, beamWidth);
            g.setBlendMode(Phaser.BlendModes.ADD);
            g.setDepth((this.player?.depth ?? 0) + 1);
            this.continuousLaserBeams.push(g);
          }
          this.player.play(getShipAttackAnim(choice), true);
          if (typeof window !== "undefined") {
            const vol = useGameStore.getState().sfxVolume ?? 0.55;
            const sfxVol = Math.max(0, Math.min(1, vol));
            this.audioManager.startContinuousLaserSound(sfxVol);
          }
        }
        const flashOffset = new Phaser.Math.Vector2(0, -28);
        flashOffset.rotate(this.aimRotation);
        const beamOriginX = this.player.x + flashOffset.x;
        const beamOriginY = this.player.y + flashOffset.y;
        if (isSuperLaser) {
          PRISM_SPREAD_ANGLES.forEach((spread, i) => {
            const g = this.continuousLaserBeams[i];
            if (!g) return;
            g.setPosition(beamOriginX, beamOriginY);
            g.setRotation(beamAngle + spread);
            g.setDepth((this.player?.depth ?? 0) + 1);
            g.setVisible(true);
          });
        } else {
          const g = this.continuousLaserBeams[0];
          if (g) {
            g.setPosition(beamOriginX, beamOriginY);
            g.setRotation(beamAngle);
            g.setDepth((this.player?.depth ?? 0) + 1);
            g.setVisible(true);
          }
        }

        const CONTINUOUS_LASER_HIT_INTERVAL_MS = 200;
        const beamHalfWidth = 18;
        if (now - this.lastContinuousLaserHitAt >= CONTINUOUS_LASER_HIT_INTERVAL_MS) {
          this.lastContinuousLaserHitAt = now;
          const baseDamage = useGameStore.getState().player?.damage ?? 18;
          const damage = Math.floor(baseDamage * 3);
          if (isSuperLaser) {
            const pointInAnyBeam = (px: number, py: number) => {
              for (const spread of PRISM_SPREAD_ANGLES) {
                const angle = beamAngle + spread;
                const cos = Math.cos(-angle);
                const sin = Math.sin(-angle);
                const lx = (px - beamOriginX) * cos - (py - beamOriginY) * sin;
                const ly = (px - beamOriginX) * sin + (py - beamOriginY) * cos;
                if (lx >= 0 && lx <= beamLength && Math.abs(ly) <= beamHalfWidth) return true;
              }
              return false;
            };
            this.enemies?.children.iterate((child) => {
              const enemy = child as Phaser.Physics.Arcade.Sprite;
              if (!enemy.active || !pointInAnyBeam(enemy.x, enemy.y)) return true;
              const enemyId = enemy.getData("id") as number | undefined;
              if (enemyId != null) {
                this.sendWorldAction("enemy_hit", { enemyId, damage, continuousLaser: true });
                this.audioManager.playEnemyHitSound();
              }
              return true;
            });
            this.otherPlayersGroup?.children.iterate((child) => {
              const other = child as Phaser.Physics.Arcade.Sprite;
              if (!other.active || !pointInAnyBeam(other.x, other.y)) return true;
              const targetUserId = other.getData("userId") as number | undefined;
              if (targetUserId != null) {
                this.sendWorldAction("player_hit", { targetUserId, damage, continuousLaser: true });
                this.audioManager.playEnemyHitSound();
              }
              return true;
            });
          } else {
            const cos = Math.cos(-beamAngle);
            const sin = Math.sin(-beamAngle);
            const pointInBeam = (px: number, py: number) => {
              const lx = (px - beamOriginX) * cos - (py - beamOriginY) * sin;
              const ly = (px - beamOriginX) * sin + (py - beamOriginY) * cos;
              return lx >= 0 && lx <= beamLength && Math.abs(ly) <= beamHalfWidth;
            };
            this.enemies?.children.iterate((child) => {
              const enemy = child as Phaser.Physics.Arcade.Sprite;
              if (!enemy.active || !pointInBeam(enemy.x, enemy.y)) return true;
              const enemyId = enemy.getData("id") as number | undefined;
              if (enemyId != null) {
                this.sendWorldAction("enemy_hit", { enemyId, damage, continuousLaser: true });
                this.audioManager.playEnemyHitSound();
              }
              return true;
            });
            this.otherPlayersGroup?.children.iterate((child) => {
              const other = child as Phaser.Physics.Arcade.Sprite;
              if (!other.active || !pointInBeam(other.x, other.y)) return true;
              const targetUserId = other.getData("userId") as number | undefined;
              if (targetUserId != null) {
                this.sendWorldAction("player_hit", { targetUserId, damage, continuousLaser: true });
                this.audioManager.playEnemyHitSound();
              }
              return true;
            });
          }
        }
      }
      const fireFromMobile =
        this.mobileState.enabled &&
        (this.mobileState.fireJustPressed ||
          (this.mobileState.fireHeld &&
            now - this.lastFiringAt > this.mobileState.fireRepeatMs));

      const fireFromKeyboard =
        this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey);

      if (fireFromMobile || fireFromKeyboard) {
        if (this.isChatInputFocused()) {
          return;
        }
        // While immune, you cannot shoot.
        if (this.isInvulnerable()) {
          this.mobileState.fireJustPressed = false;
          return;
        }
        // In safe zone, you cannot shoot. Recompute at fire time (current position) and also respect store.
        const zoneNow = this.lastWorldSafeZone;
        const zoneActiveNow = zoneNow && (zoneNow.expiresAt ?? 0) > Date.now();
        const inSafeZoneNow =
          zoneActiveNow &&
          this.isInsideSafeZone(zoneNow, this.player.x, this.player.y);
        if (
          inSafeZoneNow ||
          useGameStore.getState().playerInSafeZone
        ) {
          this.mobileState.fireJustPressed = false;
          return;
        }
        // Regular shots do not consume energy; only skills do.
        const laser = this.lasers?.create(
          this.player.x,
          this.player.y,
          "laser_blue"
        ) as Phaser.Physics.Arcade.Image | undefined;
        if (laser) {
          const choice = useGameStore.getState().user?.shipChoice;
          const tint = choice === "keeper20" ? 0xffa500 : 0xff3b3b;
          laser.setRotation(this.aimRotation);
          laser.setScale(0.7);
          laser.setTint(tint);
          const angle = this.aimRotation - Math.PI / 2;
          const laserBody = laser.body as Phaser.Physics.Arcade.Body;
          this.physics.velocityFromRotation(angle, 520, laserBody.velocity);
        }
        this.lastFiringAt = Date.now();
        // Play the eye-laser animation briefly, then revert to tentacle idle.
        const choice = useGameStore.getState().user?.shipChoice;
        const attackKey = getShipAttackAnim(choice);
        const idleKey = getShipIdleAnim(choice);
        this.player.play(attackKey, true);
        this.player.once(`animationcomplete-${attackKey}`, () => {
          // Only revert if still alive and still on the same form.
          if (!this.player || !this.player.active) {
            return;
          }
          const currentChoice = useGameStore.getState().user?.shipChoice;
          if (this.health > 0 && getShipIdleAnim(currentChoice) === idleKey) {
            this.player.play(idleKey, true);
          }
        });
        const flashOffset = new Phaser.Math.Vector2(0, -28);
        // Rotate by aimRotation (laser direction), not visual skin rotation.
        // Otherwise the flash appears offset (~45°) from the actual laser.
        flashOffset.rotate(this.aimRotation);
        const flash = this.add
          .circle(
            this.player.x + flashOffset.x,
            this.player.y + flashOffset.y,
            10,
            0x8ed5ff,
            0.9
          )
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(this.player.depth + 2);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 1.6,
          duration: 140,
          ease: "Sine.out",
          onComplete: () => flash.destroy(),
        });
        this.audioManager.playLaserSound();
        this.mobileState.fireJustPressed = false;
      }

      if (this.background) {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        this.background.tilePositionX += body.velocity.x * 0.01;
        this.background.tilePositionY += body.velocity.y * 0.01;
      }

      this.interpolateRemotePlayers();

      this.player.setDepth(this.player.y);
      this.enemies?.children.iterate((enemy) => {
        const sprite = enemy as Phaser.Physics.Arcade.Sprite;
        if (!sprite?.active) {
          return true;
        }
        sprite.setDepth(sprite.y);
        this.updateEnemyHealthBar(sprite);
        this.updateEnemyNameText(sprite);
        return true;
      });
      if (this.healthBar) {
        this.healthBar.setPosition(this.player.x, this.player.y - 60);
        this.healthBar.setDepth(this.player.depth + 3);
        this.updateHealthBar();
      }
      if (this.playerNameText) {
        const nickname = useGameStore.getState().user?.nickname ?? "";
        const level = useGameStore.getState().player?.level ?? 1;
        this.playerNameText.setText(this.formatPilotName(nickname, level));
        this.playerNameText.setPosition(this.player.x, this.player.y - 68);
        this.playerNameText.setDepth(this.player.depth + 4);
      }
      if (this.fpsText) {
        this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
      }
      if (this.invulnerableText) {
        const remaining = this.invulnerableUntil - Date.now();
        if (remaining > 0) {
          const label =
            remaining >= SPAWN_IMMUNITY_UNTIL_FIRST_ACTION / 2
              ? "Невосприимчивость: до первого действия"
              : `Невосприимчивость: ${(remaining / 1000).toFixed(1)} сек.`;
          this.invulnerableText.setText(label);
          this.invulnerableText.setPosition(this.player.x, this.player.y - 86);
          this.invulnerableText.setDepth(this.player.depth + 5);
        } else {
          this.invulnerableText.setText("");
        }
      }
      if (this.speedBuffText) {
        const speedEffect = useGameStore.getState().activeSkillEffect;
        const speedActive =
          speedEffect?.skillId === "movement_speed_5s" &&
          (speedEffect?.expiresAt ?? 0) > Date.now();
        if (speedActive && speedEffect?.expiresAt) {
          const remaining = speedEffect.expiresAt - Date.now();
          const seconds = (remaining / 1000).toFixed(1);
          this.speedBuffText.setText(`Ускорение: ${seconds} сек.`);
          this.speedBuffText.setPosition(this.player.x, this.player.y - 100);
          this.speedBuffText.setDepth(this.player.depth + 5);
        } else {
          this.speedBuffText.setText("");
        }
      }
      if (this.healingBuffText) {
        const healingEffect = useGameStore.getState().activeSkillEffect;
        const healingActive =
          healingEffect?.skillId === "healing_5s" &&
          (healingEffect?.expiresAt ?? 0) > Date.now();
        if (healingActive && healingEffect?.expiresAt) {
          const remaining = healingEffect.expiresAt - Date.now();
          const seconds = (remaining / 1000).toFixed(1);
          this.healingBuffText.setText(`Лечение: ${seconds} сек.`);
          this.healingBuffText.setPosition(this.player.x, this.player.y - 114);
          this.healingBuffText.setDepth(this.player.depth + 5);
        } else {
          this.healingBuffText.setText("");
        }
      }
      if (this.furyBuffText) {
        const furyEffect = useGameStore.getState().activeSkillEffect;
        const furyActive =
          furyEffect?.skillId === "fury_7s" &&
          (furyEffect?.expiresAt ?? 0) > Date.now();
        if (furyActive && furyEffect?.expiresAt) {
          const remaining = furyEffect.expiresAt - Date.now();
          const seconds = (remaining / 1000).toFixed(1);
          this.furyBuffText.setText(`Ярость: ${seconds} сек.`);
          this.furyBuffText.setPosition(this.player.x, this.player.y - 128);
          this.furyBuffText.setDepth(this.player.depth + 5);
        } else {
          this.furyBuffText.setText("");
        }
      }
      if (this.teleportCastText) {
        const teleportEffect = useGameStore.getState().activeSkillEffect;
        const teleportCasting =
          teleportEffect?.skillId === "teleport_3s" &&
          (teleportEffect?.expiresAt ?? 0) > Date.now();
        if (teleportCasting && teleportEffect?.expiresAt) {
          const remaining = teleportEffect.expiresAt - Date.now();
          const seconds = (remaining / 1000).toFixed(1);
          this.teleportCastText.setText(`Телепорт: ${seconds} сек.`);
          this.teleportCastText.setPosition(this.player.x, this.player.y - 142);
          this.teleportCastText.setDepth(this.player.depth + 5);
          if (!this.teleportChannelGraphics) {
            this.teleportChannelGraphics = this.add.graphics().setDepth((this.player.depth ?? 0) - 1);
          }
          this.teleportChannelGraphics.clear();
          const pulse = 0.25 + 0.12 * Math.sin(Date.now() / 120);
          this.teleportChannelGraphics.fillStyle(0xb794f6, pulse);
          this.teleportChannelGraphics.fillCircle(this.player.x, this.player.y, 36);
        } else {
          this.teleportCastText.setText("");
          if (this.teleportChannelGraphics) {
            this.teleportChannelGraphics.destroy();
            this.teleportChannelGraphics = undefined;
          }
        }
      }

      // Low health feedback: vignette, shake, heartbeat, tension track, store flag
      this.updateLowHealthEffects();

      // Main music: duck to 25% when low health so tension track is audible
      const musicVol = useGameStore.getState().musicVolume ?? 0.45;
      const baseVol = Math.max(0, Math.min(1, musicVol));
      const lowHealth = useGameStore.getState().lowHealthActive;
      this.audioManager.updateVolumes(useGameStore.getState());
    }

    private updateLowHealthEffects() {
      const ratio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
      const lowHealth =
        this.health > 0 && ratio < SpaceArenaScene.LOW_HEALTH_THRESHOLD;
      useGameStore.getState().setLowHealthActive(lowHealth);

      const cam = this.cameras.main;
      const now = this.time.now;

      if (lowHealth) {
        this.audioManager.startLowHealthMusic();
        if (!this.lowHealthVignette) {
          this.lowHealthVignette = this.add.graphics().setDepth(9999);
        }
        this.lowHealthVignette.setVisible(true);
        const sx = cam.scrollX;
        const sy = cam.scrollY;
        const w = cam.width;
        const h = cam.height;
        this.lowHealthVignette.clear();
        this.lowHealthVignette.fillStyle(0x8b0000, 0.38);
        this.lowHealthVignette.fillRect(sx, sy, w, h);
        if (now - this.lastLowHealthShakeAt > 700) {
          this.lastLowHealthShakeAt = now;
          cam.shake(250, 0.002);
        }
        if (now - this.lastHeartbeatAt > 900) {
          this.lastHeartbeatAt = now;
          this.audioManager.playHeartbeatSound();
        }
      } else {
        this.audioManager.stopLowHealthMusic();
        if (this.lowHealthVignette) {
          this.lowHealthVignette.setVisible(false);
        }
      }
    }

    private interpolateRemotePlayers() {
      const ctx: InterpolateRemotePlayersContext = {
        getServerTimeOffset: () => this.getServerTimeOffset(),
        remoteSnapshots: this.remoteSnapshots,
        otherPlayers: this.otherPlayers,
        lastWorldSafeZone: this.lastWorldSafeZone,
        isInsideSafeZone: (zone, x, y) => this.isInsideSafeZone(zone, x, y),
        formatPilotName: (nickname, level) => this.formatPilotName(nickname, level),
        updateRemoteHealthBar: (bar, sprite, health, maxHealth) =>
          this.updateRemoteHealthBar(bar, sprite, health, maxHealth),
        Phaser,
      };
      interpolateRemotePlayersFromModule(ctx);
    }
    private formatPilotName(nickname: string | null | undefined, level?: number) {
      const name = nickname && nickname.trim() ? nickname : "Пилот";
      const safeLevel = level && level > 0 ? level : 1;
      return `${name} Lv.${safeLevel}`;
    }
    private isInsideSafeZone(
      zone: WorldState["safeZone"],
      x: number,
      y: number
    ): boolean {
      if (!zone) return false;
      const dx = x - zone.x;
      const dy = y - zone.y;
      return Math.hypot(dx, dy) <= zone.radius;
    }
    private isInsideAnyGravityPit(
      pits: WorldState["gravityPits"],
      x: number,
      y: number
    ): boolean {
      return this.isInsideAnyGravityPitExcludingOwner(pits, x, y, null);
    }
    /** Returns true if (x,y) is inside any pit that is not owned by excludeOwnerId. */
    private isInsideAnyGravityPitExcludingOwner(
      pits: WorldState["gravityPits"],
      x: number,
      y: number,
      excludeOwnerId: string | number | null
    ): boolean {
      if (!pits?.length) return false;
      const now = Date.now();
      for (const pit of pits) {
        if (pit.expiresAt <= now) continue;
        if (excludeOwnerId != null && String(pit.ownerUserId) === String(excludeOwnerId)) continue;
        const dx = x - pit.x;
        const dy = y - pit.y;
        if (Math.hypot(dx, dy) <= pit.radius) return true;
      }
      return false;
    }
    private isInvulnerable() {
      return this.invulnerableUntil > Date.now();
    }
    private isChatInputFocused() {
      if (typeof document === "undefined") {
        return false;
      }
      const active = document.activeElement;
      if (!active) {
        return false;
      }
      const tag = active.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        return true;
      }
      return active.getAttribute?.("contenteditable") === "true";
    }
  };
};

export { createSpaceArenaScene };
