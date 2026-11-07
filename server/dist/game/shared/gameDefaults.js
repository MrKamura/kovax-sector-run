"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_KEYS = exports.DEFAULT_PLAYER = void 0;
exports.DEFAULT_PLAYER = {
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
    skills: ["continuous_laser", "immunity_5s", "movement_speed_5s", "healing_5s", "fury_7s", "teleport_3s", "gravity_pit"],
    lastHealthAt: null,
    posX: 0,
    posY: 0,
    rotation: 0,
    lastPositionAt: null,
    shelterLevel: 1,
    weapons: [],
    blueprints: ["rusty_blade"],
    cosmetics: [],
};
exports.RESOURCE_KEYS = ["scrap", "tokens"];
