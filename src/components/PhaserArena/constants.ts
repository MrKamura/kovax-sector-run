/** Base movement speed (pixels per second). */
export const MOVE_SPEED = 220;

/** Keeper art is drawn rotated relative to aim; rotate skin so eyes align with shots. */
export const KEEPER_SKIN_ROTATION_OFFSET = Math.PI / 2;

export const WORLD_WIDTH = 2200;
export const WORLD_HEIGHT = 1600;

/** Delay (ms) for remote player interpolation. */
export const REMOTE_INTERPOLATION_DELAY = 140;

/** Fury skill: keeper appears 25% larger. */
export const FURY_SIZE_MULT = 1.25;

/** Server sentinel: invulnerable until first action (then countdown starts). */
export const SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = 1e15;
