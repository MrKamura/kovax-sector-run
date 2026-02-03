export type PhaserModule = typeof import("phaser");

export type WorldState = {
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
    movesAt: number;
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
