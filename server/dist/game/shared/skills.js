"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_SLOT_COUNT = exports.SKILL_DEFINITIONS = void 0;
exports.getSkillDef = getSkillDef;
exports.SKILL_DEFINITIONS = {
    continuous_laser: {
        id: "continuous_laser",
        name: "Непрерывный луч",
        description: "Уровни улучшают длительность, урон и число лучей. Стоимость энергии зависит от уровня.",
        icon: "/assets/skills/icons/continuous_laser.png",
        energyCost: 7,
        durationMs: 3000,
        cooldownMs: 8000,
    },
    immunity_5s: {
        id: "immunity_5s",
        name: "Щит",
        description: "Полная неуязвимость. Длительность и стоимость зависят от уровня мутации.",
        icon: "/assets/skills/icons/immunity_5s.png",
        energyCost: 10,
        durationMs: 5000,
        cooldownMs: 12000,
        serverEffect: "immunity",
    },
    movement_speed_5s: {
        id: "movement_speed_5s",
        name: "Ускорение",
        description: "Увеличивает скорость передвижения. Длительность и множитель зависят от уровня мутации.",
        icon: "/assets/skills/icons/movement_speed_5s.png",
        energyCost: 3,
        durationMs: 5000,
        cooldownMs: 6000,
    },
    healing_5s: {
        id: "healing_5s",
        name: "Лечение",
        description: "Сильно ускоряет восстановление здоровья. Длительность зависит от уровня мутации.",
        icon: "/assets/skills/icons/healing_5s.svg",
        energyCost: 8,
        durationMs: 5000,
        cooldownMs: 10000,
        serverEffect: "healing",
    },
    fury_7s: {
        id: "fury_7s",
        name: "Ярость",
        description: "Увеличивает размер и урон. Длительность, размер и множитель урона зависят от уровня мутации.",
        icon: "/assets/skills/icons/fury_7s.svg",
        energyCost: 12,
        durationMs: 7000,
        cooldownMs: 25000,
        serverEffect: "fury",
    },
    teleport_3s: {
        id: "teleport_3s",
        name: "Телепорт",
        description: "Переносит в случайную точку сектора. Время произнесения зависит от уровня мутации.",
        icon: "/assets/skills/icons/teleport_3s.svg",
        energyCost: 15,
        durationMs: 3000,
        cooldownMs: 30000,
        serverEffect: "teleport",
    },
    gravity_pit: {
        id: "gravity_pit",
        name: "Гравитационная яма",
        description: "Создаёт зону, замедляющую врагов и игроков. Длительность и радиус зависят от уровня мутации.",
        icon: "/assets/skills/icons/gravity_pit.svg",
        energyCost: 10,
        durationMs: 5000,
        cooldownMs: 18000,
        serverEffect: "gravity_pit",
    },
};
exports.SKILL_SLOT_COUNT = 9;
function getSkillDef(skillId) {
    return exports.SKILL_DEFINITIONS[skillId] ?? null;
}
