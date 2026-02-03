/** Skill definition for UI and costs */
export type SkillDef = {
  id: string;
  name: string;
  /** Short description shown in tooltip on hover */
  description?: string;
  /** Icon path for the skill bar (e.g. /assets/skills/icons/continuous_laser.png) */
  icon: string;
  energyCost: number;
  /** Duration in ms for channeled/active effects (e.g. continuous laser) */
  durationMs?: number;
  /** Cooldown in ms before the skill can be used again */
  cooldownMs?: number;
  /** If set, client must send a server message for the effect (e.g. immunity, healing, fury, teleport, gravity_pit) */
  serverEffect?: "immunity" | "healing" | "fury" | "teleport" | "gravity_pit";
};

export const SKILL_DEFINITIONS: Record<string, SkillDef> = {
  continuous_laser: {
    id: "continuous_laser",
    name: "Непрерывный луч",
    description: "Один луч на 5 сек. Урон в 3 раза выше обычного выстрела. Стоимость: 7 энергии.",
    icon: "/assets/skills/icons/continuous_laser.png",
    energyCost: 7,
    durationMs: 5000,
    cooldownMs: 8000,
  },
  continuous_laser_super: {
    id: "continuous_laser_super",
    name: "Супер непрерывный луч",
    description: "Призматический веер лучей на 5 сек. Бьёт всех в зоне (враги и игроки), урон в 3 раза выше выстрела. Стоимость: 21 энергии.",
    icon: "/assets/skills/icons/continuous_laser.png",
    energyCost: 21,
    durationMs: 5000,
    cooldownMs: 15000,
  },
  immunity_5s: {
    id: "immunity_5s",
    name: "Щит",
    description: "Полная неуязвимость на 5 сек. Стоимость: 10 энергии.",
    icon: "/assets/skills/icons/immunity_5s.png",
    energyCost: 10,
    durationMs: 5000,
    cooldownMs: 12000,
    serverEffect: "immunity",
  },
  movement_speed_5s: {
    id: "movement_speed_5s",
    name: "Ускорение",
    description: "Увеличивает скорость передвижения на 5 сек. Стоимость: 3 энергии.",
    icon: "/assets/skills/icons/movement_speed_5s.png",
    energyCost: 3,
    durationMs: 5000,
    cooldownMs: 6000,
  },
  healing_5s: {
    id: "healing_5s",
    name: "Лечение",
    description: "Сильно ускоряет восстановление здоровья на 5 сек. Стоимость: 8 энергии.",
    icon: "/assets/skills/icons/healing_5s.svg",
    energyCost: 8,
    durationMs: 5000,
    cooldownMs: 10000,
    serverEffect: "healing",
  },
  fury_7s: {
    id: "fury_7s",
    name: "Ярость",
    description: "Увеличивает размер киппера и урон на 7 сек. Стоимость: 12 энергии.",
    icon: "/assets/skills/icons/fury_7s.svg",
    energyCost: 12,
    durationMs: 7000,
    cooldownMs: 25000,
    serverEffect: "fury",
  },
  teleport_3s: {
    id: "teleport_3s",
    name: "Телепорт",
    description: "Через 3 сек переносит в случайную точку сектора. Стоимость: 15 энергии. Долгая перезарядка.",
    icon: "/assets/skills/icons/teleport_3s.svg",
    energyCost: 15,
    durationMs: 3000,
    cooldownMs: 30000,
    serverEffect: "teleport",
  },
  gravity_pit: {
    id: "gravity_pit",
    name: "Гравитационная яма",
    description: "Создаёт зону на 5 сек, замедляющую врагов и игроков внутри. Радиус ~180 px. Стоимость: 10 энергии.",
    icon: "/assets/skills/icons/gravity_pit.svg",
    energyCost: 10,
    durationMs: 5000,
    cooldownMs: 18000,
    serverEffect: "gravity_pit",
  },
};

export const SKILL_SLOT_COUNT = 9;

export function getSkillDef(skillId: string): SkillDef | null {
  return SKILL_DEFINITIONS[skillId] ?? null;
}
