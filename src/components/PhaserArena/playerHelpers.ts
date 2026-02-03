import { KEEPER_SKIN_ROTATION_OFFSET } from "./constants";
import { PLAYER_MONSTER_CHOICES } from "./monsterDefs";

type ShipChoice = string | null | undefined;

const defaultChoice = PLAYER_MONSTER_CHOICES.keeper19;

export function getShipChoice(choice: ShipChoice) {
  return PLAYER_MONSTER_CHOICES[choice ?? ""] ?? defaultChoice;
}

export function getShipTexture(choice: ShipChoice) {
  return getShipChoice(choice).spriteKey;
}

export function getShipIdleAnim(choice: ShipChoice) {
  return getShipChoice(choice).idleAnim;
}

export function getShipBlindAnim(choice: ShipChoice) {
  return getShipChoice(choice).blindAnim;
}

export function getShipAttackAnim(choice: ShipChoice) {
  return getShipChoice(choice).attackAnim;
}

export function getShipSpeedMultiplier(choice: ShipChoice) {
  return getShipChoice(choice).speedMultiplier;
}

export function getShipScale(choice: ShipChoice) {
  return getShipChoice(choice).scale;
}

/** Scale factor for sprite size by level; capped to avoid huge hitboxes. */
export function getLevelScale(level: number) {
  const safe = Number.isFinite(level) ? Math.max(1, level) : 1;
  return Math.min(1.6, 1 + (safe - 1) * 0.03);
}

/** Speed multiplier by level. */
export function getLevelSpeedMultiplier(level: number) {
  const safe = Number.isFinite(level) ? Math.max(1, level) : 1;
  return 1 + (safe - 1) * 0.03;
}

export function getSkinRotationOffset(choice: ShipChoice) {
  return choice === "keeper19" || choice === "keeper20"
    ? KEEPER_SKIN_ROTATION_OFFSET
    : 0;
}

export function getShipEyeOffset(choice: ShipChoice) {
  return getShipChoice(choice).eyeOffset;
}
