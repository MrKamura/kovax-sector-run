import { GAME_TITLE, STUDIO_NAME } from "@/lib/gameBranding";

export { GAME_TITLE, STUDIO_NAME };

export const INTRO_STORY_TEXT =
  "Человечество начало активное освоение космоса и вторглось в новую галактику, населённую киперами. Эти существа обитают в открытом космосе. Они способны развиваться и приспосабливаться к среде, мутировать и становиться сильнее, уничтожая враждебные корабли и других киперов. Вы — один из них. Выберите форму и вступите в борьбу за выживание.";

export const TYPEWRITER_MS = 26;
export const SPLASH_VISIBLE_MS = 2500;
export const MAX_LEVEL = 100;

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const pct = (value: number, max: number): number => {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const raw = (safeValue / safeMax) * 100;
  const adjusted = raw > 0 && raw < 6 ? 6 : raw;
  return clamp(Math.round(adjusted), 0, 100);
};
