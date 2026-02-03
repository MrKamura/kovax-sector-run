export const DEFAULT_PLAYER = {
  name: "Survivor",
  resources: {
    scrap: 0,
    tokens: 0,
  },
  health: 100,
  maxHealth: 100,
  level: 1,
  exp: 0,
  expToNext: 100,
  damage: 18,
  skills: ["continuous_laser", "continuous_laser_super", "immunity_5s", "movement_speed_5s", "healing_5s", "fury_7s", "teleport_3s", "gravity_pit"] as string[],
  lastHealthAt: null as Date | null,
  posX: 0,
  posY: 0,
  rotation: 0,
  lastPositionAt: null as Date | null,
  shelterLevel: 1,
  weapons: [] as Array<{ id: string; name: string; power: number }>,
  blueprints: ["rusty_blade"] as string[],
  cosmetics: [] as string[],
};

export const RESOURCE_KEYS = ["scrap", "tokens"] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];
