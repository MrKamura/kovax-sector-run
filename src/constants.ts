import { GAME_TITLE, STUDIO_NAME } from "@/lib/gameBranding";

export { GAME_TITLE, STUDIO_NAME };

export const INTRO_STORY_TEXT =
  "Человечество начало активное освоение космоса и вторглось в новую галактику, населённую киперами. Эти существа обитают в открытом космосе. Они способны развиваться и приспосабливаться к среде, мутировать и становиться сильнее, уничтожая враждебные корабли и других киперов. Вы — один из них. Выберите форму и вступите в борьбу за выживание.";

export const TYPEWRITER_MS = 26;
export const SPLASH_VISIBLE_MS = 1200;
export const MAX_LEVEL = 100;

/** Tutorial: 10 seconds of invulnerability after completing all hints */
export const TUTORIAL_BUFF_DURATION_MS = 10000;

export const TUTORIAL_PANELS = [
  {
    id: "player",
    title: "Панель игрока",
    description:
      "Здесь отображаются здоровье, энергия, навыки и слоты способностей. Нажмите на слот или используйте горячие клавиши (1–9) для активации способностей.",
  },
  {
    id: "quests",
    title: "Квесты",
    description:
      "Ежедневные квесты на убийство мобов или PvP. Примите квест, выполните условия и получите опыт и токены.",
  },
  {
    id: "resources",
    title: "Ресурсы",
    description:
      "Энергия нужна для сбора скрапа. Токены — для покупки мутаций и улучшений в меню.",
  },
  {
    id: "menu",
    title: "Меню",
    description:
      "Настройки звука, смена корабля, мутации и выход из игры.",
  },
] as const;

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const pct = (value: number, max: number): number => {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const raw = (safeValue / safeMax) * 100;
  const adjusted = raw > 0 && raw < 6 ? 6 : raw;
  return clamp(Math.round(adjusted), 0, 100);
};
