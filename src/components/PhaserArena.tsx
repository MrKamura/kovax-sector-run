import { useGameStore } from "@/store/gameStore";

const MOVE_SPEED = 220;
// Keeper art is drawn rotated relative to our aim rotation.
// Rotate the *skin* (visual only) so eyes align with shots, while keeping aim/laser math unchanged.
// If it still doesn't match perfectly, adjust this angle.
const KEEPER_SKIN_ROTATION_OFFSET = Math.PI / 2;
const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1600;
const REMOTE_INTERPOLATION_DELAY = 140;
const FURY_SIZE_MULT = 1.25; // Fury skill: keeper appears 25% larger
/** Server sentinel: invulnerable until first action (then countdown starts). */
const SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = 1e15;

type PhaserModule = typeof import("phaser");
type WorldState = {
  seed: number;
  sector?: {
    id: string;
    name: string;
    level: number;
    color: string;
    width: number;
    height: number;
  };
  blackHoles?: Array<{
    id: string;
    x: number;
    y: number;
    type: "warp" | "same";
    targetSectorId?: string;
    targetSectorName?: string;
    targetLevel?: number;
    targetColor?: string;
    appearsAt?: number;
    expiresAt: number;
  }>;
  safeZone?: {
    id: string;
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
    movesAt: number; // server timestamp (ms) when zone will relocate
    color: string;
  } | null;
  pickups: Array<{
    id: number;
    x: number;
    y: number;
    resource: "scrap" | "tokens";
  }>;
  asteroids: Array<{
    id: number;
    x: number;
    y: number;
    texture:
      | "meteor_small"
      | "meteor_big"
      | "meteor_grey_small"
      | "meteor_grey_big";
    scale: number;
  }>;
  enemies: Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
    texture:
      | "mob_keeper19"
      | "mob_keeper20"
      | "enemy_blue_1"
      | "enemy_red_2"
      | "enemy_green_3"
      | "enemy_black_4"
      | "enemy_alt_blue"
      | "enemy_alt_red"
      | "enemy_alt_green"
      | "enemy_alt_black";
    level: number;
    damage: number;
    health: number;
    maxHealth: number;
  }>;
  gravityPits?: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
    ownerUserId?: string | number;
  }>;
};

const MONSTER_DEFS: Record<
  string,
  {
    name: string;
    animKey?: string;
  }
> = {
  // Enemy ships: sci‑fi spacecraft/mission names (RU, international).
  // One fixed name per ship type so it's readable and consistent.
  enemy_blue_1: { name: "Союз-5" },
  enemy_red_2: { name: "Вояджер" },
  enemy_green_3: { name: "Аполлон-11" },
  enemy_black_4: { name: "Шэньчжоу-7" },
  enemy_alt_blue: { name: "Ариан-5" },
  enemy_alt_red: { name: "Хаябуса-2" },
  enemy_alt_green: { name: "Чандраян-3" },
  enemy_alt_black: { name: "Кассини" },

  // Player monsters.
  mob_keeper19: { name: "Shardling", animKey: "mob_keeper19_idle" },
  mob_keeper20: { name: "Nullseer", animKey: "mob_keeper20_idle" },
};

const PLAYER_MONSTER_CHOICES: Record<
  string,
  {
    spriteKey: "mob_keeper19" | "mob_keeper20";
    idleAnim: string;
    attackAnim: string;
    blindAnim: string;
    speedMultiplier: number;
    scale: number;
    eyeOffset: { x: number; y: number };
  }
> = {
  keeper19: {
    spriteKey: "mob_keeper19",
    idleAnim: "mob_keeper19_idle",
    attackAnim: "mob_keeper19_attack",
    blindAnim: "mob_keeper19_blind",
    speedMultiplier: 1.15,
    scale: 0.8,
    // Local sprite space offset (before rotation), tuned for SV sheet.
    eyeOffset: { x: 0, y: -34 },
  },
  keeper20: {
    spriteKey: "mob_keeper20",
    idleAnim: "mob_keeper20_idle",
    attackAnim: "mob_keeper20_attack",
    blindAnim: "mob_keeper20_blind",
    speedMultiplier: 0.9,
    scale: 0.62,
    eyeOffset: { x: 6, y: -42 },
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpColor = (from: number, to: number, t: number) => {
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(lerp(fr, tr, t));
  const g = Math.round(lerp(fg, tg, t));
  const b = Math.round(lerp(fb, tb, t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

const formatSectorDisplayName = (raw: string) => {
  // Server names look like "Green L1 • Aquila-12".
  // Players want to see only one sector name (the suffix after "•").
  const parts = raw.split("•");
  return (parts[parts.length - 1] ?? raw).trim();
};

const monsterNameColor = (monsterLevel: number, playerLevel: number) => {
  const green = 0x2ecc71;
  const red = 0xff5a5a;
  const white = 0xf1f4fb;
  const diff = monsterLevel - playerLevel;
  if (diff === 0) {
    return lerpColor(green, green, 0);
  }
  const t = Math.min(1, Math.abs(diff) / 5);
  return diff > 0 ? lerpColor(green, red, t) : lerpColor(green, white, t);
};

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
    private continuousLaserSound?: HTMLAudioElement;
    /** Web Audio nodes for synthesized heat-vision sound when .ogg is missing */
    private continuousLaserSynthetic?: { oscillator: OscillatorNode; gain: GainNode };
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
    private socketReconnectTimer?: Phaser.Time.TimerEvent;
    private serverTimeOffset = 0;
    private playerPulse?: Phaser.Tweens.Tween;
    private playerFacing: "n" | "s" | "e" | "w" = "s";
    private audioContext?: AudioContext;
    private audioUnlocked = false;
    private musicTrack?: HTMLAudioElement;
    /** Unique hard-core tension track when health < 25% (tension_low_health.ogg or .mp3) */
    private lowHealthMusicTrack?: HTMLAudioElement;
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
    private lastWorldGravityPits: WorldState["gravityPits"] = [];
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
    private mobileControlsEnabled = false;
    private joystickBase?: Phaser.GameObjects.Arc;
    private joystickThumb?: Phaser.GameObjects.Arc;
    private joystickPointerId: number | null = null;
    private joystickCenterX = 0;
    private joystickCenterY = 0;
    private joystickRadius = 54;
    private joystickX = 0; // [-1..1]
    private joystickY = 0; // [-1..1]
    private fireButton?: Phaser.GameObjects.Arc;
    private firePointerId: number | null = null;
    private fireHeld = false;
    private fireJustPressed = false;
    private readonly fireRepeatMs = 160;
    private playerSpeedMultiplier = 1;
    private aimRotation = 0;
    private appliedLevelScale = 1;

    constructor() {
      super({ key: "SpaceArenaScene" });
    }

    preload() {
      this.load.image(
        "space_bg",
        "/assets/kenney/space-shooter/Backgrounds/darkPurple.png"
      );
      this.load.image(
        "ship_player_1",
        "/assets/kenney/space-shooter-redux/PNG/playerShip1_blue.png"
      );
      this.load.image(
        "ship_player_2",
        "/assets/kenney/space-shooter-redux/PNG/playerShip2_green.png"
      );
      this.load.image(
        "ship_player_3",
        "/assets/kenney/space-shooter-redux/PNG/playerShip3_red.png"
      );
      this.load.image(
        "meteor_big",
        "/assets/kenney/space-shooter/PNG/Meteors/meteorBrown_big1.png"
      );
      this.load.image(
        "meteor_small",
        "/assets/kenney/space-shooter/PNG/Meteors/meteorBrown_small1.png"
      );
      this.load.image(
        "meteor_grey_big",
        "/assets/kenney/space-shooter/PNG/Meteors/meteorGrey_big1.png"
      );
      this.load.image(
        "meteor_grey_small",
        "/assets/kenney/space-shooter/PNG/Meteors/meteorGrey_small1.png"
      );
      this.load.image(
        "pickup_scrap",
        "/assets/kenney/space-shooter-redux/PNG/Power-ups/bolt_bronze.png"
      );
      this.load.image(
        "pickup_tokens",
        "/assets/kenney/space-shooter-redux/PNG/Power-ups/star_gold.png"
      );
      this.load.image(
        "laser_blue",
        "/assets/kenney/space-shooter/PNG/Lasers/laserBlue07.png"
      );
      // Keeper-2 SV battlers (192x64 frames, 9xN sheets).
      this.load.spritesheet(
        "mob_keeper19",
        "/assets/mobs/keeper-2/waechter-19/waechter-19/sv_waechter-19.png",
        { frameWidth: 192, frameHeight: 64 }
      );
      this.load.spritesheet(
        "mob_keeper20",
        "/assets/mobs/keeper-2/waechter-20/waechter-20/waechter-20 SV_Battler.png",
        { frameWidth: 192, frameHeight: 128 }
      );
      this.load.image(
        "enemy_blue_1",
        "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyBlue1.png"
      );
      this.load.image(
        "enemy_red_2",
        "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyRed2.png"
      );
      this.load.image(
        "enemy_green_3",
        "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyGreen3.png"
      );
      this.load.image(
        "enemy_black_4",
        "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyBlack4.png"
      );
      this.load.image(
        "enemy_alt_blue",
        "/assets/kenney/space-shooter/PNG/Enemies/enemyBlue4.png"
      );
      this.load.image(
        "enemy_alt_red",
        "/assets/kenney/space-shooter/PNG/Enemies/enemyRed4.png"
      );
      this.load.image(
        "enemy_alt_green",
        "/assets/kenney/space-shooter/PNG/Enemies/enemyGreen4.png"
      );
      this.load.image(
        "enemy_alt_black",
        "/assets/kenney/space-shooter/PNG/Enemies/enemyBlack4.png"
      );
      this.load.image(
        "black_hole_1",
        "/assets/kenney/space-shooter/PNG/Effects/star1.png"
      );
      this.load.image(
        "black_hole_2",
        "/assets/kenney/space-shooter/PNG/Effects/star2.png"
      );
      this.load.image(
        "black_hole_3",
        "/assets/kenney/space-shooter/PNG/Effects/star3.png"
      );
    }

    private isTouchDevice() {
      // Phaser device flags are the most reliable inside the game context
      return (
        !!this.sys.game.device.input.touch ||
        !!this.sys.game.device.os.android ||
        !!this.sys.game.device.os.iOS ||
        (typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0)
      );
    }

    private layoutMobileControls(width: number, height: number) {
      const pad = 24;
      const baseR = this.joystickRadius;
      const fireR = 46;

      this.joystickCenterX = pad + baseR;
      this.joystickCenterY = height - pad - baseR;

      if (this.joystickBase) {
        this.joystickBase.setPosition(this.joystickCenterX, this.joystickCenterY);
      }
      if (this.joystickThumb) {
        this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
      }
      if (this.fireButton) {
        this.fireButton.setPosition(width - pad - fireR, height - pad - fireR);
      }
    }

    private setupMobileControls() {
      this.mobileControlsEnabled = this.isTouchDevice();
      if (!this.mobileControlsEnabled) {
        return;
      }

      // allow multi-touch (move + fire)
      this.input.addPointer(2);

      // Visuals
      this.joystickBase = this.add
        .circle(0, 0, this.joystickRadius, 0x0f141b, 0.55)
        .setStrokeStyle(2, 0x5a6b7f, 0.65)
        .setScrollFactor(0)
        .setDepth(1000);
      this.joystickThumb = this.add
        .circle(0, 0, Math.max(18, Math.floor(this.joystickRadius * 0.42)), 0x9fd9ff, 0.75)
        .setStrokeStyle(2, 0x0f1116, 0.55)
        .setScrollFactor(0)
        .setDepth(1001);

      this.fireButton = this.add
        .circle(0, 0, 46, 0x8ed5ff, 0.2)
        .setStrokeStyle(2, 0x8ed5ff, 0.7)
        .setScrollFactor(0)
        .setDepth(1000);

      this.layoutMobileControls(this.scale.width, this.scale.height);

      this.scale.on("resize", (gameSize: { width: number; height: number }) => {
        this.layoutMobileControls(gameSize.width, gameSize.height);
      });

      const inCircle = (px: number, py: number, cx: number, cy: number, r: number) => {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy <= r * r;
      };

      const updateJoystick = (pointer: Phaser.Input.Pointer) => {
        const dx = pointer.x - this.joystickCenterX;
        const dy = pointer.y - this.joystickCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0;
        const clamp = Math.min(dist, this.joystickRadius);
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;
        const clampedX = nx * clamp;
        const clampedY = ny * clamp;
        this.joystickX = this.joystickRadius > 0 ? clampedX / this.joystickRadius : 0;
        this.joystickY = this.joystickRadius > 0 ? clampedY / this.joystickRadius : 0;
        if (this.joystickThumb) {
          this.joystickThumb.setPosition(
            this.joystickCenterX + clampedX,
            this.joystickCenterY + clampedY
          );
        }
      };

      const resetJoystick = () => {
        this.joystickPointerId = null;
        this.joystickX = 0;
        this.joystickY = 0;
        if (this.joystickThumb) {
          this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
        }
      };

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (this.isChatInputFocused()) {
          return;
        }
        if (
          this.joystickPointerId == null &&
          inCircle(pointer.x, pointer.y, this.joystickCenterX, this.joystickCenterY, this.joystickRadius + 14)
        ) {
          this.joystickPointerId = pointer.id;
          updateJoystick(pointer);
          return;
        }
        if (this.firePointerId == null && this.fireButton) {
          const fx = this.fireButton.x;
          const fy = this.fireButton.y;
          if (inCircle(pointer.x, pointer.y, fx, fy, 58)) {
            this.firePointerId = pointer.id;
            this.fireHeld = true;
            this.fireJustPressed = true;
          }
        }
      });

      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (pointer.id === this.joystickPointerId) {
          updateJoystick(pointer);
        }
      });

      const releasePointer = (pointer: Phaser.Input.Pointer) => {
        if (pointer.id === this.joystickPointerId) {
          resetJoystick();
        }
        if (pointer.id === this.firePointerId) {
          this.firePointerId = null;
          this.fireHeld = false;
          this.fireJustPressed = false;
        }
      };

      this.input.on("pointerup", releasePointer);
      this.input.on("pointerupoutside", releasePointer);
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

      // Define monster animations once.
      const createKeeperAnim = (
        sheetKey: "mob_keeper19" | "mob_keeper20",
        animKey: string,
        row: number,
        startCol = 0,
        frameCount = 3,
        opts?: { frameRate?: number; repeat?: number }
      ) => {
        if (this.anims.exists(animKey)) {
          return;
        }
        const start = row * 9 + startCol;
        const end = start + Math.max(0, frameCount - 1);
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(sheetKey, { start, end }),
          frameRate: opts?.frameRate ?? 6,
          repeat: opts?.repeat ?? -1,
        });
      };
      // Idle (first 3 frames of row 0)
      createKeeperAnim("mob_keeper19", "mob_keeper19_idle", 0, 0, 3);
      createKeeperAnim("mob_keeper20", "mob_keeper20_idle", 0, 0, 3);
      // Attack (eye-laser frames appear mid-row)
      // IMPORTANT: attack must NOT loop.
      createKeeperAnim("mob_keeper19", "mob_keeper19_attack", 0, 3, 3, {
        frameRate: 10,
        repeat: 0,
      });
      createKeeperAnim("mob_keeper20", "mob_keeper20_attack", 3, 3, 3, {
        frameRate: 10,
        repeat: 0,
      });
      // "Blind" (use last row of each sheet)
      createKeeperAnim("mob_keeper19", "mob_keeper19_blind", 5, 0, 3);
      createKeeperAnim("mob_keeper20", "mob_keeper20_blind", 5, 0, 3);
      if (!this.anims.exists("blackHolePulse")) {
        this.anims.create({
          key: "blackHolePulse",
          frames: [
            { key: "black_hole_1" },
            { key: "black_hole_2" },
            { key: "black_hole_3" },
          ],
          frameRate: 6,
          repeat: -1,
        });
      }
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
      const shipTexture = this.getShipTexture(user?.shipChoice);
      this.player = this.physics.add
        .sprite(spawnX, spawnY, shipTexture)
        .setScale(
          this.getShipScale(user?.shipChoice) *
            this.getLevelScale(useGameStore.getState().player?.level ?? 1)
        )
        .setCollideWorldBounds(true);
      // Spawn immunity: invulnerable until first movement (prevents mobs killing on login).
      this.invulnerableUntil = SPAWN_IMMUNITY_UNTIL_FIRST_ACTION;
      this.playerSpeedMultiplier =
        this.getShipSpeedMultiplier(user?.shipChoice) *
        this.getLevelSpeedMultiplier(useGameStore.getState().player?.level ?? 1);
      this.appliedLevelScale = this.getLevelScale(useGameStore.getState().player?.level ?? 1);
      this.aimRotation = spawnRotation;
      this.player.setRotation(
        spawnRotation + this.getSkinRotationOffset(user?.shipChoice)
      );
      this.player.play(this.getShipIdleAnim(user?.shipChoice));
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
      // Unlock audio on first interaction ANYWHERE (canvas or UI overlay).
      this.input.once("pointerdown", this.unlockAudio, this);
      this.input.keyboard?.once("keydown", this.unlockAudio, this);
      const unlockFromWindow = () => this.unlockAudio();
      window.addEventListener("pointerdown", unlockFromWindow, { once: true });
      window.addEventListener("keydown", unlockFromWindow, { once: true });
      this.events.once("shutdown", this.stopMusic, this);
      this.events.once("destroy", this.stopMusic, this);
      this.events.once("shutdown", this.clearPresence, this);
      this.events.once("destroy", this.clearPresence, this);

      this.unsubscribeMusicVolume = useGameStore.subscribe((state, prev) => {
        const prevVolume = prev?.musicVolume;
        if (state.musicVolume !== prevVolume && this.musicTrack) {
          const base = Math.max(0, Math.min(1, state.musicVolume ?? 0.45));
          const factor = state.lowHealthActive ? 0.25 : 1;
          this.musicTrack.volume = base * factor;
        }
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
          this.playPickupSound();
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
        this.playEnemyAttackSound();
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
        this.playExplosionSound();
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
        this.playEnemyHitSound();
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
        this.playEnemyHitSound();
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

      this.setupMobileControls();
    }
    private ensureAudioContext() {
      if (this.audioContext && this.audioContext.state === "closed") {
        this.audioContext = undefined;
      }
      if (!this.audioContext) {
        const AudioCtx =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      return this.audioContext;
    }

    private unlockAudio() {
      const context = this.ensureAudioContext();
      // Resume MUST be triggered from a user gesture; if it fails we just
      // keep audio locked until the next gesture.
      if (context.state === "suspended") {
        void context
          .resume()
          .then(() => {
            this.audioUnlocked = context.state === "running";
            this.startMusic();
          })
          .catch(() => {
            this.audioUnlocked = false;
          });
        return;
      }
      this.audioUnlocked = context.state === "running";
      this.startMusic();
    }

    /** Level 1 green sectors: let-the-games-begin; Level 2 yellow: space */
    private static readonly MUSIC_LEVEL1 = "/assets/music/let-the-games-begin-21858.mp3";
    private static readonly MUSIC_LEVEL2 = "/assets/music/space-438391.mp3";

    private getMainMusicUrlForLevel(level: number): string {
      return level >= 2 ? SpaceArenaScene.MUSIC_LEVEL2 : SpaceArenaScene.MUSIC_LEVEL1;
    }

    private startMusic() {
      if (this.musicTrack || !this.audioUnlocked) {
        return;
      }
      const context = this.ensureAudioContext();
      if (context.state !== "running") {
        return;
      }
      const url = this.getMainMusicUrlForLevel(this.currentSectorLevel);
      this.musicTrack = new Audio(url);
      this.musicTrack.loop = true;
      const musicVol = useGameStore.getState().musicVolume ?? 0.45;
      this.musicTrack.volume = Math.max(0, Math.min(1, musicVol));
      void this.musicTrack.play().catch(() => {});
    }

    /** Switch main music to the track for the given sector level (1 = green, 2 = yellow). */
    private switchMainMusicToSectorLevel(level: number) {
      if (this.currentSectorLevel === level) return;
      this.currentSectorLevel = level;
      if (!this.musicTrack || !this.audioUnlocked) return;
      const url = this.getMainMusicUrlForLevel(level);
      const musicVol = useGameStore.getState().musicVolume ?? 0.45;
      const baseVol = Math.max(0, Math.min(1, musicVol));
      const lowHealth = useGameStore.getState().lowHealthActive;
      const vol = lowHealth ? baseVol * 0.25 : baseVol;
      try {
        this.musicTrack.pause();
        this.musicTrack.currentTime = 0;
      } catch {
        // ignore
      }
      this.musicTrack = undefined;
      const next = new Audio(url);
      next.loop = true;
      next.volume = vol;
      this.musicTrack = next;
      void next.play().catch(() => {});
    }

    private stopMusic() {
      if (this.musicTrack) {
        try {
          this.musicTrack.pause();
          this.musicTrack.currentTime = 0;
        } catch {
          // ignore
        }
        this.musicTrack = undefined;
      }
      this.stopLowHealthMusic();
    }

    /** Unique low-health tension track. Tries OGG, then MP3, then SpacyLoop. You add tension_low_health.ogg or .mp3 yourself. */
    private static readonly LOW_HEALTH_TRACK_OGG = "/assets/music/tension_low_health.ogg";
    private static readonly LOW_HEALTH_TRACK_MP3 = "/assets/music/tension_low_health.mp3";
    private static readonly LOW_HEALTH_FALLBACK = "/assets/music/SpacyLoop.ogg";

    /** Start tension track when health < 25%; play when loaded. See public/assets/music/README.md for where to download your own. */
    private startLowHealthMusic() {
      if (this.lowHealthMusicTrack || !this.audioUnlocked) return;
      const musicVol = useGameStore.getState().musicVolume ?? 0.45;
      const vol = Math.max(0, Math.min(1, musicVol));
      const tryLoad = (url: string, onError: () => void) => {
        const audio = new Audio(url);
        audio.loop = true;
        audio.volume = vol;
        const tryPlay = () => {
          if (this.lowHealthMusicTrack !== audio) return;
          void audio.play().catch(() => {});
        };
        audio.addEventListener("canplaythrough", tryPlay, { once: true });
        audio.addEventListener("error", onError, { once: true });
        this.lowHealthMusicTrack = audio;
        tryPlay();
      };
      tryLoad(SpaceArenaScene.LOW_HEALTH_TRACK_OGG, () => {
        if (this.lowHealthMusicTrack === undefined) return;
        this.lowHealthMusicTrack = undefined;
        tryLoad(SpaceArenaScene.LOW_HEALTH_TRACK_MP3, () => {
          if (this.lowHealthMusicTrack === undefined) return;
          this.lowHealthMusicTrack = undefined;
          tryLoad(SpaceArenaScene.LOW_HEALTH_FALLBACK, () => {
            this.lowHealthMusicTrack = undefined;
          });
        });
      });
    }

    private stopLowHealthMusic() {
      if (this.lowHealthMusicTrack) {
        try {
          this.lowHealthMusicTrack.pause();
          this.lowHealthMusicTrack.currentTime = 0;
        } catch {
          // ignore
        }
        this.lowHealthMusicTrack = undefined;
      }
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
      this.playShipHitSound();
      this.cameras.main.shake(120, 0.004);
      void damagePlayerAction(actualDamage);
    }

    private playLaserSound() {
      if (!this.audioUnlocked) {
        return;
      }
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const sfx = Math.max(0, Math.min(1, sfxVol));
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.05 * sfx, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.12);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }

    /** Heat-vision style sustained sound when continuous_laser.ogg is not available */
    private startContinuousLaserSyntheticSound(sfxVol: number) {
      if (!this.audioUnlocked) {
        return;
      }
      const context = this.ensureAudioContext();
      const osc = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      filter.Q.value = 0.5;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, context.currentTime);
      gain.gain.setValueAtTime(0.06 * Math.max(0, Math.min(1, sfxVol)), context.currentTime);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      osc.start(0);
      this.continuousLaserSynthetic = { oscillator: osc, gain };
    }

    private playPickupSound() {
      if (!this.audioUnlocked) {
        return;
      }
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const sfx = Math.max(0, Math.min(1, sfxVol));
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.05 * sfx, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.14);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }

    private playExplosionSound() {
      if (!this.audioUnlocked) {
        return;
      }
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const sfx = Math.max(0, Math.min(1, sfxVol));
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const buffer = context.createBuffer(1, context.sampleRate * 0.25, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.12 * sfx, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start(now);
      source.stop(now + 0.24);
    }

    private playEnemyHitSound() {
      // Procedural zap to avoid Phaser WebAudio context edge-cases.
      if (!this.audioUnlocked) {
        return;
      }
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const sfx = Math.max(0, Math.min(1, sfxVol));
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const minGain = 0.0001; // exponentialRampToValueAtTime requires strictly positive values
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      gain.gain.setValueAtTime(minGain, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(minGain, 0.06 * sfx), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(minGain, now + 0.14);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.16);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }

    private playEnemyAttackSound() {
      if (!this.audioUnlocked) {
        return;
      }
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const sfx = Math.max(0, Math.min(1, sfxVol));
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const minGain = 0.0001; // exponentialRampToValueAtTime requires strictly positive values
      osc.type = "square";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
      gain.gain.setValueAtTime(minGain, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(minGain, 0.04 * sfx), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(minGain, now + 0.2);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.22);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }

    /** Level-up: synthesized fanfare only (no main-music clip). */
    private playLevelUpFanfare() {
      if (typeof window === "undefined") return;
      const playSynthesizedFanfare = () => {
        if (!this.audioUnlocked) return;
        const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
        const sfx = Math.max(0, Math.min(1, sfxVol));
        const context = this.ensureAudioContext();
        const now = context.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0, now + i * 0.12);
          gain.gain.linearRampToValueAtTime(0.12 * sfx, now + i * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.25);
          osc.connect(gain);
          gain.connect(context.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.26);
        });
      };
      playSynthesizedFanfare();
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
      this.playLevelUpFanfare();
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
      level: number;
      color: string;
      width: number;
      height: number;
    }) {
      if (!sector) {
        return;
      }
      const level = Math.max(1, Math.min(2, sector.level));
      this.switchMainMusicToSectorLevel(level);
      if (this.background) {
        this.background.setSize(sector.width, sector.height);
        this.background.setDisplaySize(sector.width, sector.height);
        this.background.clearTint();
      }
      this.physics.world.setBounds(0, 0, sector.width, sector.height);
      this.cameras.main.setBounds(0, 0, sector.width, sector.height);
      if (this.sectorText) {
        this.sectorText.setText(`Сектор: ${formatSectorDisplayName(sector.name)}`);
        this.sectorText.setColor(sector.color);
      }
      if (this.currentSectorId !== sector.id) {
        this.appliedServerPosition = false;
      }
      this.currentSectorId = sector.id;
    }

    /** Heartbeat-style lub-dub (two low thumps) for low-health feedback */
    private playHeartbeatSound() {
      if (!this.audioUnlocked) return;
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const vol = Math.max(0, Math.min(1, sfxVol)) * 0.2;
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const playThump = (t: number) => {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.08);
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(vol, t + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gainNode);
        gainNode.connect(context.destination);
        osc.start(t);
        osc.stop(t + 0.14);
      };
      playThump(now);
      playThump(now + 0.15);
    }

    private playShipHitSound() {
      if (!this.audioUnlocked) {
        return;
      }
      const sfxVol = useGameStore.getState().sfxVolume ?? 0.55;
      const sfx = Math.max(0, Math.min(1, sfxVol));
      const context = this.ensureAudioContext();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);
      gain.gain.setValueAtTime(0.08 * sfx, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }

    private getShipChoice(choice: string | null | undefined) {
      return PLAYER_MONSTER_CHOICES[choice ?? ""] ?? PLAYER_MONSTER_CHOICES.keeper19;
    }

    private getShipTexture(choice: string | null | undefined) {
      return this.getShipChoice(choice).spriteKey;
    }

    private getShipIdleAnim(choice: string | null | undefined) {
      return this.getShipChoice(choice).idleAnim;
    }

    private getShipBlindAnim(choice: string | null | undefined) {
      return this.getShipChoice(choice).blindAnim;
    }

    private getShipAttackAnim(choice: string | null | undefined) {
      return this.getShipChoice(choice).attackAnim;
    }

    private getShipSpeedMultiplier(choice: string | null | undefined) {
      return this.getShipChoice(choice).speedMultiplier;
    }

    private getShipScale(choice: string | null | undefined) {
      return this.getShipChoice(choice).scale;
    }

    private getLevelScale(level: number) {
      const safe = Number.isFinite(level) ? Math.max(1, level) : 1;
      // Grow slowly with level, capped to avoid absurd hitboxes.
      return Math.min(1.6, 1 + (safe - 1) * 0.03);
    }

    private getLevelSpeedMultiplier(level: number) {
      const safe = Number.isFinite(level) ? Math.max(1, level) : 1;
      return 1 + (safe - 1) * 0.03;
    }

    private getSkinRotationOffset(choice: string | null | undefined) {
      return choice === "keeper19" || choice === "keeper20"
        ? KEEPER_SKIN_ROTATION_OFFSET
        : 0;
    }

    private getShipEyeOffset(choice: string | null | undefined) {
      return this.getShipChoice(choice).eyeOffset;
    }

    private applyPlayerMonsterChoice(choice: string | null | undefined) {
      if (!this.player) {
        return;
      }
      const texture = this.getShipTexture(choice);
      if (this.player.texture.key !== texture) {
        this.player.setTexture(texture);
      }
      const level = useGameStore.getState().player?.level ?? 1;
      const levelScale = this.getLevelScale(level);
      this.player.setScale(this.getShipScale(choice) * levelScale);
      this.appliedLevelScale = levelScale;
      this.playerSpeedMultiplier =
        this.getShipSpeedMultiplier(choice) * this.getLevelSpeedMultiplier(level);
      this.player.setMaxVelocity(MOVE_SPEED * this.playerSpeedMultiplier);
      this.player.play(this.getShipIdleAnim(choice), true);
      this.player.setRotation(this.aimRotation + this.getSkinRotationOffset(choice));
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
      if (!this.socketShouldReconnect || typeof window === "undefined") {
        return;
      }
      // Assume spawn immunity immediately so we're invulnerable before "self" arrives (prevents mobs killing on login).
      this.invulnerableUntil = SPAWN_IMMUNITY_UNTIL_FIRST_ACTION;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socketUrl = `${protocol}://${window.location.host}/ws`;
      try {
        this.socket = new WebSocket(socketUrl);
      } catch {
        return;
      }
      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type: string;
            serverTime?: number;
            invulnerableUntil?: number;
            death?: { lostTokens: number; lostExp: number; killedBy?: string; killedByUserId?: number };
            vengeance?: {
              targetUserId: number;
              targetNickname: string;
              expiresAt: number;
              targetSectorId: string | null;
              targetSectorName: string | null;
            } | null;
            hunted?: {
              hunterUserId: number;
              hunterNickname: string;
              expiresAt: number;
            } | null;
            players?: Array<{
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
            }>;
            world?: WorldState;
            player?: {
              level?: number;
              exp?: number;
              expToNext?: number;
              maxHealth?: number;
              damage?: number;
              health?: number;
              resources?: { scrap: number; tokens: number };
              posX?: number;
              posY?: number;
              rotation?: number;
              lastPositionAt?: string;
            };
          };
          if (payload.type === "presence" && payload.players) {
            this.handlePresencePayload(payload.players, payload.serverTime);
          }
          if (payload.type === "world" && payload.world) {
            this.handleWorldPayload(payload.world, payload.serverTime);
          }
          if (payload.type === "self") {
            this.invulnerableUntil = Number(payload.invulnerableUntil ?? 0);
            if (payload.vengeance !== undefined) {
              useGameStore.getState().setVengeance(payload.vengeance ?? null);
            }
            if (payload.hunted !== undefined) {
              useGameStore.getState().setHunted(payload.hunted ?? null);
            }
            const p = payload as { posX?: number; posY?: number };
            const posX = typeof p.posX === "number" ? p.posX : undefined;
            const posY = typeof p.posY === "number" ? p.posY : undefined;
            if (posX != null && posY != null && this.player) {
              this.player.setPosition(posX, posY);
              this.appliedServerPosition = true;
              useGameStore.getState().applyPlayerUpdate({ posX, posY });
            }
          }
          if (payload.type === "death" && payload.death) {
            useGameStore.getState().setDeathInfo(payload.death);
          }
          if (payload.type === "player_update" && payload.player) {
            if (payload.player.lastPositionAt) {
              this.appliedServerPosition = false;
            }
            if (typeof payload.player.health === "number") {
              this.health = payload.player.health;
            }
            if (typeof payload.player.maxHealth === "number") {
              this.maxHealth = payload.player.maxHealth;
            }
            useGameStore.getState().applyPlayerUpdate(payload.player);
            const celebration = useGameStore.getState().levelUpCelebration;
            if (celebration) {
              this.triggerLevelUpEffects(celebration);
            }
          }
          if (payload.type === "teleport_complete") {
            const p = payload as { x?: number; y?: number };
            const x = Number(p.x);
            const y = Number(p.y);
            if (this.player && Number.isFinite(x) && Number.isFinite(y)) {
              const oldX = this.player.x;
              const oldY = this.player.y;
              useGameStore.getState().setActiveSkillEffect(null);
              this.playTeleportOutEffect(oldX, oldY);
              this.player.x = x;
              this.player.y = y;
              this.playTeleportInEffect(x, y);
            }
          }
          if (payload.type === "exit_ready") {
            const store = useGameStore.getState();
            store.clearExitCountdown();
            this.clearPresence();
            if (store.exitThenLogout) {
              store.setExitThenLogout(false);
              void store.logout();
            }
          }
          if (payload.type === "sector_kill_flash") {
            const p = payload as { killerName?: string; victimName?: string };
            const killerName = String(p.killerName ?? "").trim() || "Пилот";
            const victimName = String(p.victimName ?? "").trim() || "Пилот";
            useGameStore.getState().setSectorKillFlash({ killerName, victimName });
            this.time.delayedCall(2000, () => {
              useGameStore.getState().setSectorKillFlash(null);
            });
          }
          if (payload.type === "player_shot_result") {
            const p = payload as {
              attackerUserId?: number;
              victimUserId?: number;
              attackerX?: number;
              attackerY?: number;
            };
            const myUserId = useGameStore.getState().user?.id ?? null;
            const victimUserId = Number(p.victimUserId);
            const attackerUserId = Number(p.attackerUserId);
            const attackerX = Number(p.attackerX);
            const attackerY = Number(p.attackerY);
            if (
              myUserId != null &&
              victimUserId === myUserId &&
              Number.isFinite(attackerUserId) &&
              Number.isFinite(attackerX) &&
              Number.isFinite(attackerY)
            ) {
              this.lastCorrectiveShotByAttacker.set(attackerUserId, Date.now());
              // Remove the wrong laser we spawned from presence (it flies past); we'll show the corrective one
              const wrongLaser = this.lastRemoteLaserByShooter.get(attackerUserId);
              if (wrongLaser && Date.now() - wrongLaser.at < 800 && wrongLaser.laser.active) {
                wrongLaser.laser.destroy();
              }
              this.lastRemoteLaserByShooter.delete(attackerUserId);
              this.spawnCorrectiveLaser(attackerX, attackerY, attackerUserId);
            }
          }
        } catch {
          // ignore malformed payloads
        }
      };
      this.socket.onclose = () => {
        if (!this.socketShouldReconnect) {
          return;
        }
        if (this.socketReconnectTimer) {
          this.socketReconnectTimer.remove(false);
        }
        this.socketReconnectTimer = this.time.delayedCall(800, () => {
          this.connectSocket();
        });
      };
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

    private handlePresencePayload(
      players: Array<{
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
      }>,
      serverTime?: number
    ) {
      if (typeof serverTime === "number") {
        const nextOffset = serverTime - Date.now();
        this.serverTimeOffset = Phaser.Math.Linear(
          this.serverTimeOffset,
          nextOffset,
          0.1
        );
      }
      const selfId = useGameStore.getState().user?.id;
      const seen = new Set<number>();
      for (const entry of players) {
        if (selfId && entry.userId === selfId) {
          continue;
        }
        if (entry.isDead) {
          const remote = this.otherPlayers.get(entry.userId);
          if (remote) {
            remote.sprite.destroy();
            remote.nameText.destroy();
            remote.healthBar.destroy();
            this.otherPlayers.delete(entry.userId);
            this.remoteSnapshots.delete(entry.userId);
          }
          continue;
        }
        seen.add(entry.userId);
        this.upsertRemotePlayer(entry);
        this.queueRemoteSnapshot(entry);
      }
      for (const [userId, remote] of this.otherPlayers.entries()) {
        if (!seen.has(userId)) {
          remote.sprite.destroy();
          remote.nameText.destroy();
          remote.healthBar.destroy();
          this.otherPlayers.delete(userId);
          this.remoteSnapshots.delete(userId);
        }
      }
    }

    private handleWorldPayload(world: WorldState, serverTime?: number) {
      if (typeof serverTime === "number") {
        const nextOffset = serverTime - Date.now();
        this.serverTimeOffset = Phaser.Math.Linear(
          this.serverTimeOffset,
          nextOffset,
          0.1
        );
      }
      this.applySectorInfo(world.sector);
      this.syncWorld(world);
    }

    private sendWorldAction(type: string, payload: Record<string, unknown>) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }
      this.socket.send(
        JSON.stringify({
          type,
          ...payload,
        })
      );
    }

    private syncWorld(world: WorldState) {
      // Always update safe zone from world so firing check has correct zone even if we return early.
      const safeZoneFromWorld = world.safeZone ?? null;
      this.lastWorldSafeZone = safeZoneFromWorld;
      if (safeZoneFromWorld) {
        this.safeZoneMovesAt = safeZoneFromWorld.movesAt ?? safeZoneFromWorld.expiresAt ?? 0;
      } else {
        this.safeZoneMovesAt = 0;
      }
      this.lastWorldGravityPits = (world.gravityPits ?? []).map((p) => ({
        ...p,
        ownerUserId: p.ownerUserId != null ? String(p.ownerUserId) : undefined,
      }));
      if (!this.pickups || !this.enemies || !this.asteroids) {
        return;
      }
      const seenPickups = new Set<number>();
      for (const pickup of world.pickups) {
        seenPickups.add(pickup.id);
        const existing = this.pickupSprites.get(pickup.id);
        if (existing) {
          existing.setPosition(pickup.x, pickup.y);
          continue;
        }
        const texture =
          pickup.resource === "scrap" ? "pickup_scrap" : "pickup_tokens";
        const sprite = this.pickups
          .create(pickup.x, pickup.y, texture)
          .setData("resource", pickup.resource)
          .setData("id", pickup.id);
        sprite.setScale(pickup.resource === "tokens" ? 0.85 : 0.8);
        sprite.setImmovable(true);
        this.tweens.add({
          targets: sprite,
          y: sprite.y - 8,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
        this.pickupSprites.set(pickup.id, sprite);
      }
      for (const [id, sprite] of this.pickupSprites.entries()) {
        if (!seenPickups.has(id)) {
          sprite.destroy();
          this.pickupSprites.delete(id);
        }
      }

      const seenAsteroids = new Set<number>();
      for (const asteroid of world.asteroids) {
        seenAsteroids.add(asteroid.id);
        const existing = this.asteroidSprites.get(asteroid.id);
        if (existing) {
          // IMPORTANT: static bodies don't move with setPosition() unless refreshed.
          existing.setPosition(asteroid.x, asteroid.y);
          if (existing.scaleX !== asteroid.scale || existing.scaleY !== asteroid.scale) {
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
        const sprite = this.asteroids
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
        this.asteroidSprites.set(asteroid.id, sprite);
      }
      for (const [id, sprite] of this.asteroidSprites.entries()) {
        if (!seenAsteroids.has(id)) {
          sprite.destroy();
          this.asteroidSprites.delete(id);
        }
      }

      const seenEnemies = new Set<number>();
      for (const enemy of world.enemies) {
        seenEnemies.add(enemy.id);
        const existing = this.enemySprites.get(enemy.id);
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
          this.updateEnemyHealthBar(existing);
          this.updateEnemyNameText(existing);
          continue;
        }
        const sprite = this.enemies
          .create(enemy.x, enemy.y, enemy.texture)
          .setScale(enemy.texture.startsWith("enemy_") ? 0.95 : enemy.texture === "mob_keeper20" ? 0.62 : 0.8) as Phaser.Physics.Arcade.Sprite;
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
        const bar = this.add.graphics();
        sprite.setData("healthBar", bar);
        const nameText = this.add.text(sprite.x, sprite.y, "", {
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
        this.updateEnemyHealthBar(sprite);
        this.updateEnemyNameText(sprite);
        this.enemySprites.set(enemy.id, sprite);
      }
      for (const [id, sprite] of this.enemySprites.entries()) {
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
          this.enemySprites.delete(id);
        }
      }

      this.lastWorldGravityPits = (world.gravityPits ?? []).map((p) => ({
        ...p,
        ownerUserId: p.ownerUserId != null ? String(p.ownerUserId) : undefined,
      }));
      this.syncGravityPitGraphics();

      const holes: NonNullable<WorldState["blackHoles"]> = world.blackHoles ?? [];
      const seenIds = new Set<string>();
      for (const bh of holes) {
        seenIds.add(bh.id);
        let entry = this.blackHoleSprites.get(bh.id);
        const tintHex =
          typeof bh.targetColor === "string" &&
          /^#?[0-9a-fA-F]{6}$/.test(bh.targetColor)
            ? parseInt(bh.targetColor.replace("#", ""), 16)
            : null;
        if (!entry) {
          const sprite = this.physics.add
            .sprite(bh.x, bh.y, "black_hole_1")
            .setDepth(6);
          sprite.setScale(1.5);
          sprite.setAlpha(tintHex != null ? 0.9 : 0.75);
          sprite.play("blackHolePulse");
          if (tintHex != null) sprite.setTint(tintHex);
          else sprite.clearTint();
          sprite.setData("holeData", bh);
          this.tweens.add({
            targets: sprite,
            scale: 1.7,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
          });
          this.tweens.add({
            targets: sprite,
            angle: 360,
            duration: 4000,
            repeat: -1,
            ease: "Linear",
          });
          sprite.setInteractive({ useHandCursor: true });
          sprite.on("pointerover", () => {
            this.hoveredBlackHoleData = sprite.getData("holeData");
            this.showBlackHoleTooltip();
          });
          sprite.on("pointerout", () => {
            this.hoveredBlackHoleData = null;
            this.hideBlackHoleTooltip();
          });
          let label: Phaser.GameObjects.Text | undefined;
          if (bh.targetSectorName) {
            label = this.add
              .text(bh.x, bh.y - 78, formatSectorDisplayName(bh.targetSectorName), {
                fontFamily: "Arial",
                fontSize: "12px",
                color: bh.targetColor ?? "#ffffff",
              })
              .setOrigin(0.5, 1);
            label.setShadow(0, 2, "#000000", 4, true, true);
            label.setDepth(7);
          }
          const initialRemaining = Math.max(
            0,
            Math.floor((bh.expiresAt - Date.now()) / 1000)
          );
          const countdownLabel = this.add
            .text(bh.x, bh.y - 95, `Закроется: ${initialRemaining} с`, {
              fontFamily: "Arial",
              fontSize: "11px",
              color: "#b0b0b0",
            })
            .setOrigin(0.5, 1);
          countdownLabel.setShadow(0, 1, "#000000", 3, true, true);
          countdownLabel.setDepth(7);
          entry = { sprite, label, countdownLabel };
          this.blackHoleSprites.set(bh.id, entry);
        } else {
          entry.sprite.setPosition(bh.x, bh.y);
          entry.sprite.setData("holeData", bh);
          if (entry.label) {
            entry.label.setPosition(bh.x, bh.y - 78);
          }
          entry.countdownLabel.setPosition(bh.x, bh.y - 95);
        }
      }
      for (const [id, entry] of this.blackHoleSprites.entries()) {
        if (!seenIds.has(id)) {
          entry.sprite.destroy();
          entry.label?.destroy();
          entry.countdownLabel.destroy();
          this.blackHoleSprites.delete(id);
        }
      }
      if (this.blackHoleSprites.size === 0) {
        this.hoveredBlackHoleData = null;
        this.hideBlackHoleTooltip();
      }

      // Immunity zone (safe zone) — lastWorldSafeZone already set at start of syncWorld
      const zone = this.lastWorldSafeZone;
      if (zone) {
        if (!this.safeZoneGraphics || this.safeZoneId !== zone.id) {
          this.safeZoneGraphics?.destroy();
          this.safeZoneTitleLabel?.destroy();
          this.safeZoneLabel?.destroy();
          this.hideSafeZoneTooltip();
          this.safeZoneGraphics = this.add.graphics();
          this.safeZoneId = zone.id;
          this.safeZoneMovesAt = zone.movesAt ?? zone.expiresAt;
          const colorHex =
            typeof zone.color === "string" && /^#?[0-9a-fA-F]{6}$/.test(zone.color)
              ? parseInt(zone.color.replace("#", ""), 16)
              : 0x2ecc71;
          // Ring + subtle fill
          this.safeZoneGraphics.fillStyle(colorHex, 0.08);
          this.safeZoneGraphics.fillCircle(zone.x, zone.y, zone.radius);
          this.safeZoneGraphics.lineStyle(3, colorHex, 0.55);
          this.safeZoneGraphics.strokeCircle(zone.x, zone.y, zone.radius);
          this.safeZoneGraphics.setDepth(5);
          this.safeZoneTitleLabel = this.add
            .text(zone.x, zone.y - zone.radius - 28, "Безопасная зона", {
              fontFamily: "Arial",
              fontSize: "13px",
              color: zone.color ?? "#2ecc71",
            })
            .setOrigin(0.5, 1);
          this.safeZoneTitleLabel.setShadow(0, 2, "#000000", 4, true, true);
          this.safeZoneTitleLabel.setDepth(6);
          const initialRemaining = Math.max(0, Math.floor((zone.expiresAt - Date.now()) / 1000));
          this.safeZoneLabel = this.add
            .text(zone.x, zone.y - zone.radius - 10, `${initialRemaining} с`, {
              fontFamily: "Arial",
              fontSize: "12px",
              color: zone.color ?? "#2ecc71",
            })
            .setOrigin(0.5, 1);
          this.safeZoneLabel.setShadow(0, 2, "#000000", 4, true, true);
          this.safeZoneLabel.setDepth(6);
          this.safeZoneGraphics.setInteractive({
            hitArea: new Phaser.Geom.Circle(zone.x, zone.y, zone.radius),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            useHandCursor: true,
          });
          this.safeZoneGraphics.on("pointerover", () => this.showSafeZoneTooltip());
          this.safeZoneGraphics.on("pointerout", () => this.hideSafeZoneTooltip());
        } else if (this.safeZoneGraphics) {
          // Update move time from server (when zone will relocate).
          this.safeZoneMovesAt = zone.movesAt ?? zone.expiresAt;
          if (this.safeZoneTitleLabel) {
            this.safeZoneTitleLabel.setPosition(zone.x, zone.y - zone.radius - 28);
          }
          if (this.safeZoneLabel) {
            this.safeZoneLabel.setPosition(zone.x, zone.y - zone.radius - 10);
          }
          this.safeZoneGraphics.setInteractive({
            hitArea: new Phaser.Geom.Circle(zone.x, zone.y, zone.radius),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            useHandCursor: true,
          });
        }
      } else {
        this.safeZoneGraphics?.destroy();
        this.safeZoneGraphics = undefined;
        this.safeZoneTitleLabel?.destroy();
        this.safeZoneTitleLabel = undefined;
        this.safeZoneLabel?.destroy();
        this.safeZoneLabel = undefined;
        this.hideSafeZoneTooltip();
        this.safeZoneId = undefined;
        this.safeZoneMovesAt = 0;
      }
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
      const buffer = this.remoteSnapshots.get(entry.userId) ?? [];
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
      this.remoteSnapshots.set(entry.userId, buffer);
      const remote = this.otherPlayers.get(entry.userId);
      if (remote && entry.firingAt && entry.firingAt > remote.lastFiringAt) {
        remote.lastFiringAt = entry.firingAt;
        // Skip if we recently showed a corrective laser for this shot (victim sees server-authoritative laser)
        const lastCorrective = this.lastCorrectiveShotByAttacker.get(entry.userId);
        if (!lastCorrective || Date.now() - lastCorrective > 400) {
          this.spawnRemoteLaser(remote.sprite, entry.userId);
        }
      }
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
      const isHunted =
        entry.isHunted === true ||
        (typeof entry.huntedExpiresAt === "number" && entry.huntedExpiresAt > Date.now());
      const nameColor = isHunted ? "#e74c3c" : "#b9c4d6";
      const existing = this.otherPlayers.get(entry.userId);
      if (!existing) {
        const sprite = this.physics.add
          .sprite(entry.x, entry.y, this.getShipTexture(entry.shipChoice))
          .setScale(this.getShipScale(entry.shipChoice))
          .setCollideWorldBounds(true);
        sprite.setDamping(true);
        sprite.setDrag(0.9);
        sprite.setMaxVelocity(MOVE_SPEED * this.getShipSpeedMultiplier(entry.shipChoice));
        sprite.setDepth(entry.y);
        sprite.setRotation(entry.rotation + this.getSkinRotationOffset(entry.shipChoice));
        sprite.setData("userId", entry.userId);
        this.otherPlayersGroup?.add(sprite);
        sprite.setAlpha(
          Number(entry.invulnerableUntil ?? 0) > Date.now() ? 0.55 : 1
        );
        sprite.play(this.getShipIdleAnim(entry.shipChoice));
        sprite.setData("aimRotation", entry.rotation);
        const nameText = this.add
          .text(entry.x, entry.y - 68, this.formatPilotName(entry.nickname, entry.level), {
            fontFamily: "Arial",
            fontSize: "12px",
            color: nameColor,
          })
          .setOrigin(0.5, 1);
        const healthBar = this.add.graphics();
        this.otherPlayers.set(entry.userId, {
          sprite,
          nameText,
          healthBar,
          lastFiringAt: 0,
          huntedExpiresAt: entry.huntedExpiresAt,
        });
        sprite.setData("shipChoice", entry.shipChoice ?? null);
        this.updateRemoteHealthBar(healthBar, sprite, entry.health, entry.maxHealth);
      } else {
        existing.nameText.setText(this.formatPilotName(entry.nickname, entry.level));
        existing.nameText.setColor(nameColor);
        existing.huntedExpiresAt = entry.huntedExpiresAt;
        const expectedTexture = this.getShipTexture(entry.shipChoice);
        if (existing.sprite.texture.key !== expectedTexture) {
          existing.sprite.setTexture(expectedTexture);
          existing.sprite.play(this.getShipIdleAnim(entry.shipChoice));
        }
        existing.sprite.setData("shipChoice", entry.shipChoice ?? null);
        existing.sprite.setData("aimRotation", entry.rotation);
      }
    }

    private showBlackHoleTooltip() {
      this.hideBlackHoleTooltip();
      const bh = this.hoveredBlackHoleData;
      if (!bh) return;
      const sectorName = bh.targetSectorName
        ? formatSectorDisplayName(bh.targetSectorName)
        : "неизвестный сектор";
      const playerLevel = useGameStore.getState().player?.level ?? 1;
      const targetLevel = bh.targetLevel ?? 1;
      const accessOpen =
        targetLevel === 1 || playerLevel >= 3;
      const accessLine = accessOpen
        ? "Доступ открыт"
        : "Доступ закрыт: нужен 3+ уровень для жёлтых секторов.";
      const lines = [
        `Чёрная дыра — портал в сектор ${sectorName}.`,
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

    private clearPresence() {
      this.socketShouldReconnect = false;
      if (this.socketReconnectTimer) {
        this.socketReconnectTimer.remove(false);
        this.socketReconnectTimer = undefined;
      }
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
      this.stopLowHealthMusic();
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
      const ratio = Phaser.Math.Clamp(health / maxHealth, 0, 1);
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
          this.syncGravityPitGraphics();
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
        const desiredLevelScale = this.getLevelScale(level);
        if (Math.abs(desiredLevelScale - this.appliedLevelScale) > 0.0001) {
          this.appliedLevelScale = desiredLevelScale;
          this.player.setScale(this.getShipScale(choice) * desiredLevelScale);
          this.playerSpeedMultiplier =
            this.getShipSpeedMultiplier(choice) *
            this.getLevelSpeedMultiplier(level);
          this.player.setMaxVelocity(MOVE_SPEED * this.playerSpeedMultiplier);
          // Keep aiming rotation stable; only adjust skin offset.
          this.player.setRotation(
            this.aimRotation + this.getSkinRotationOffset(choice)
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
              this.getSkinRotationOffset(useGameStore.getState().user?.shipChoice)
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
        this.player.setVelocity(0, 0);
        this.player.setVisible(true);
        this.player.play(this.getShipBlindAnim(useGameStore.getState().user?.shipChoice), true);
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
        this.player.setVisible(true);
        this.player.play(this.getShipIdleAnim(useGameStore.getState().user?.shipChoice), true);
        this.player.setScale(this.getShipScale(useGameStore.getState().user?.shipChoice));
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
        this.mobileControlsEnabled &&
        (Math.abs(this.joystickX) > 0.12 || Math.abs(this.joystickY) > 0.12);

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

      this.player.setMaxVelocity(
        MOVE_SPEED * this.playerSpeedMultiplier * movementSpeedBoost * gravityPitFactor * lowHealthSpeedBoost
      );

      // Fury skill: increase keeper size for duration; restore when effect ends
      const furyActive =
        useGameStore.getState().activeSkillEffect?.skillId === "fury_7s" &&
        (useGameStore.getState().activeSkillEffect?.expiresAt ?? 0) > Date.now();
      const choice = useGameStore.getState().user?.shipChoice;
      const baseScale = this.getShipScale(choice) * this.appliedLevelScale;
      const furyScale = baseScale * (furyActive ? FURY_SIZE_MULT : 1);
      this.player.setScale(furyScale);
      const body = this.player.body as Phaser.Physics.Arcade.Body | null;
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
        inputX = this.joystickX;
        inputY = this.joystickY;
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
          rotation + this.getSkinRotationOffset(useGameStore.getState().user?.shipChoice)
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
        if (this.continuousLaserSound) {
          this.continuousLaserSound.pause();
          this.continuousLaserSound.currentTime = 0;
          this.continuousLaserSound = undefined;
        }
        if (this.continuousLaserSynthetic) {
          try {
            this.continuousLaserSynthetic.oscillator.stop();
            this.continuousLaserSynthetic.oscillator.disconnect();
            this.continuousLaserSynthetic.gain.disconnect();
          } catch {
            // already stopped
          }
          this.continuousLaserSynthetic = undefined;
        }
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
          this.player.play(this.getShipAttackAnim(choice), true);
          if (typeof window !== "undefined") {
            const vol = useGameStore.getState().sfxVolume ?? 0.55;
            const sfxVol = Math.max(0, Math.min(1, vol * 0.7));
            const sound = new Audio("/assets/sfx/continuous_laser.ogg");
            sound.loop = true;
            sound.volume = sfxVol;
            sound.play().then(() => {
              this.continuousLaserSound = sound;
            }).catch(() => {
              this.startContinuousLaserSyntheticSound(sfxVol);
            });
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
                this.playEnemyHitSound();
              }
              return true;
            });
            this.otherPlayersGroup?.children.iterate((child) => {
              const other = child as Phaser.Physics.Arcade.Sprite;
              if (!other.active || !pointInAnyBeam(other.x, other.y)) return true;
              const targetUserId = other.getData("userId") as number | undefined;
              if (targetUserId != null) {
                this.sendWorldAction("player_hit", { targetUserId, damage, continuousLaser: true });
                this.playEnemyHitSound();
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
                this.playEnemyHitSound();
              }
              return true;
            });
            this.otherPlayersGroup?.children.iterate((child) => {
              const other = child as Phaser.Physics.Arcade.Sprite;
              if (!other.active || !pointInBeam(other.x, other.y)) return true;
              const targetUserId = other.getData("userId") as number | undefined;
              if (targetUserId != null) {
                this.sendWorldAction("player_hit", { targetUserId, damage, continuousLaser: true });
                this.playEnemyHitSound();
              }
              return true;
            });
          }
        }
      }
      const fireFromMobile =
        this.mobileControlsEnabled &&
        (this.fireJustPressed ||
          (this.fireHeld && now - this.lastFiringAt > this.fireRepeatMs));

      const fireFromKeyboard =
        this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey);

      if (fireFromMobile || fireFromKeyboard) {
        if (this.isChatInputFocused()) {
          return;
        }
        // While immune, you cannot shoot.
        if (this.isInvulnerable()) {
          this.fireJustPressed = false;
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
          this.fireJustPressed = false;
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
        const attackKey = this.getShipAttackAnim(choice);
        const idleKey = this.getShipIdleAnim(choice);
        this.player.play(attackKey, true);
        this.player.once(`animationcomplete-${attackKey}`, () => {
          // Only revert if still alive and still on the same form.
          if (!this.player || !this.player.active) {
            return;
          }
          const currentChoice = useGameStore.getState().user?.shipChoice;
          if (this.health > 0 && this.getShipIdleAnim(currentChoice) === idleKey) {
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
        this.playLaserSound();
        this.fireJustPressed = false;
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
      if (this.musicTrack) {
        this.musicTrack.volume = lowHealth ? baseVol * 0.25 : baseVol;
      }
      // Low-health track: same volume as main music (music slider)
      if (this.lowHealthMusicTrack) {
        this.lowHealthMusicTrack.volume = baseVol;
      }
    }

    private updateLowHealthEffects() {
      const ratio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
      const lowHealth =
        this.health > 0 && ratio < SpaceArenaScene.LOW_HEALTH_THRESHOLD;
      useGameStore.getState().setLowHealthActive(lowHealth);

      const cam = this.cameras.main;
      const now = this.time.now;

      if (lowHealth) {
        this.startLowHealthMusic();
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
          this.playHeartbeatSound();
        }
      } else {
        this.stopLowHealthMusic();
        if (this.lowHealthVignette) {
          this.lowHealthVignette.setVisible(false);
        }
      }
    }

    private interpolateRemotePlayers() {
      const renderTime =
        Date.now() + this.serverTimeOffset - REMOTE_INTERPOLATION_DELAY;
      for (const [userId, remote] of this.otherPlayers.entries()) {
        const buffer = this.remoteSnapshots.get(userId);
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
          const t = Phaser.Math.Clamp(alpha, 0, 1);
          x = Phaser.Math.Linear(snapshotA.x, snapshotB.x, t);
          y = Phaser.Math.Linear(snapshotA.y, snapshotB.y, t);
          const delta = Phaser.Math.Angle.Wrap(
            snapshotB.rotation - snapshotA.rotation
          );
          rotation = snapshotA.rotation + delta * t;
          health = Phaser.Math.Linear(snapshotA.health, snapshotB.health, t);
          maxHealth = snapshotB.maxHealth;
          invulnerableUntil = snapshotB.invulnerableUntil ?? invulnerableUntil;
        }
        remote.sprite.setPosition(x, y);
        const zone = this.lastWorldSafeZone;
        const zoneActive = zone && (zone.expiresAt ?? 0) > Date.now();
        const remoteInSafeZone =
          zoneActive && this.isInsideSafeZone(zone, x, y);
        remote.sprite.setAlpha(
          remoteInSafeZone ? 0.35 : invulnerableUntil > Date.now() ? 0.55 : 1
        );
        const remoteChoice = remote.sprite.getData("shipChoice") as
          | string
          | null
          | undefined;
        remote.sprite.setRotation(
          rotation + this.getSkinRotationOffset(remoteChoice)
        );
        remote.sprite.setData("aimRotation", rotation);
        remote.sprite.setDepth(y);
        remote.nameText.setPosition(x, y - 68);
        const nickname = snapshotB?.nickname ?? snapshotA.nickname ?? "Пилот";
        const level = snapshotB?.level ?? snapshotA.level ?? 1;
        remote.nameText.setText(this.formatPilotName(nickname, level));
        this.updateRemoteHealthBar(remote.healthBar, remote.sprite, health, maxHealth);
      }
    }
    private formatPilotName(nickname: string | null | undefined, level?: number) {
      const name = nickname && nickname.trim() ? nickname : "Пилот";
      const safeLevel = level && level > 0 ? level : 1;
      return `${name} Lv.${safeLevel}`;
    }
    /** Sync gravity pit visuals from lastWorldGravityPits with vortex animation */
    private syncGravityPitGraphics() {
      const pits = (this.lastWorldGravityPits ?? []).filter(
        (p) => p.expiresAt > Date.now()
      );
      const seenIds = new Set<string>();
      for (const pit of pits) {
        seenIds.add(pit.id);
        let container = this.gravityPitContainers.get(pit.id);
        if (!container) {
          container = this.add.container(pit.x, pit.y);
          container.setDepth(5.5);
          const g = this.add.graphics();
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
          this.gravityPitContainers.set(pit.id, container);
          this.tweens.add({
            targets: container,
            angle: 360,
            duration: 4000,
            repeat: -1,
            ease: "Linear",
          });
          this.tweens.add({
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
      for (const [id, c] of this.gravityPitContainers.entries()) {
        if (!seenIds.has(id)) {
          c.destroy();
          this.gravityPitContainers.delete(id);
        }
      }
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
