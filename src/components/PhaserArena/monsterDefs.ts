export const MONSTER_DEFS: Record<
  string,
  { name: string; animKey?: string }
> = {
  enemy_blue_1: { name: "Союз-5" },
  enemy_red_2: { name: "Вояджер" },
  enemy_green_3: { name: "Аполлон-11" },
  enemy_black_4: { name: "Шэньчжоу-7" },
  enemy_alt_blue: { name: "Ариан-5" },
  enemy_alt_red: { name: "Хаябуса-2" },
  enemy_alt_green: { name: "Чандраян-3" },
  enemy_alt_black: { name: "Кассини" },
  mob_keeper19: { name: "Shardling", animKey: "mob_keeper19_idle" },
  mob_keeper20: { name: "Nullseer", animKey: "mob_keeper20_idle" },
};

export const PLAYER_MONSTER_CHOICES: Record<
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
