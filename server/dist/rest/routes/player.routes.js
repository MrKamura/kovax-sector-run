"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpgradeShelter = exports.handleDamagePlayer = exports.handleCraft = exports.handleConsumeEnergy = exports.handleCollect = exports.handlePlayerGet = void 0;
const playerRepo_1 = require("../playerRepo");
const auth_1 = require("../auth");
const http_1 = require("../http");
const gameDefaults_1 = require("../../game/shared/gameDefaults");
const recipes_1 = require("../../game/shared/recipes");
const handlePlayerGet = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const nextExpiry = await (0, auth_1.refreshSession)(ctx.db, auth.token);
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    // Apply passive regen on periodic player refresh only (not on every action).
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice, { applyRegen: true });
    (0, http_1.sendJson)(res, 200, {
        player: player.toJSON(),
        user: {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            shipChoice: user.shipChoice,
            musicVolume: Number(user.musicVolume ?? 0.45),
            sfxVolume: Number(user.sfxVolume ?? 0.55),
        },
    }, nextExpiry && auth.token
        ? [(0, http_1.sessionCookieHeader)(auth.token, nextExpiry)]
        : undefined);
};
exports.handlePlayerGet = handlePlayerGet;
const handleCollect = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const resource = body?.resource;
    if (!resource || !gameDefaults_1.RESOURCE_KEYS.includes(resource)) {
        (0, http_1.sendJson)(res, 400, { error: "Unknown resource." });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    const resources = {
        ...gameDefaults_1.DEFAULT_PLAYER.resources,
        ...player.resources,
    };
    const gain = resource === "scrap" ? 3 : 1;
    if (resource === "scrap") {
        const level = player.level ?? 1;
        const capacity = 10 + Math.max(0, level - 1) * 3;
        resources.scrap = Math.min(resources.scrap + gain, capacity);
    }
    else {
        resources[resource] += gain;
    }
    player.resources = resources;
    player.lastCollectedAt = new Date();
    await player.save();
    (0, http_1.sendJson)(res, 200, { player: player.toJSON() });
};
exports.handleCollect = handleCollect;
const handleConsumeEnergy = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const body = (await (0, http_1.readJsonBody)(req));
    const amount = Math.max(1, Math.floor(Number(body?.amount ?? 1)) || 1);
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    const resources = {
        ...gameDefaults_1.DEFAULT_PLAYER.resources,
        ...player.resources,
    };
    if (resources.scrap < amount) {
        (0, http_1.sendJson)(res, 400, { error: "Not enough energy." });
        return;
    }
    resources.scrap -= amount;
    player.resources = resources;
    await player.save();
    (0, http_1.sendJson)(res, 200, { player: player.toJSON() });
};
exports.handleConsumeEnergy = handleConsumeEnergy;
const handleCraft = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const recipeId = body?.recipeId;
    if (!recipeId || !recipes_1.RECIPES[recipeId]) {
        (0, http_1.sendJson)(res, 400, { error: "Unknown recipe." });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    const recipe = recipes_1.RECIPES[recipeId];
    const blueprints = player.blueprints?.length > 0 ? player.blueprints : gameDefaults_1.DEFAULT_PLAYER.blueprints;
    if (!blueprints.includes(recipeId)) {
        (0, http_1.sendJson)(res, 403, { error: "Blueprint locked." });
        return;
    }
    const resources = {
        ...gameDefaults_1.DEFAULT_PLAYER.resources,
        ...player.resources,
    };
    for (const [key, value] of Object.entries(recipe.cost)) {
        const amount = resources[key] ?? 0;
        if (amount < value) {
            (0, http_1.sendJson)(res, 400, { error: "Not enough resources." });
            return;
        }
    }
    for (const [key, value] of Object.entries(recipe.cost)) {
        resources[key] -= value;
    }
    player.resources = resources;
    player.weapons = [
        ...(player.weapons ?? []),
        {
            id: recipe.id,
            name: recipe.produces.weaponName,
            power: recipe.produces.power,
        },
    ];
    if (recipe.unlocksBlueprint) {
        player.blueprints = Array.from(new Set([...blueprints, recipe.unlocksBlueprint]));
    }
    await player.save();
    (0, http_1.sendJson)(res, 200, { player: player.toJSON() });
};
exports.handleCraft = handleCraft;
const handleDamagePlayer = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const amount = Math.max(0, Number(body?.amount ?? 0));
    if (!amount) {
        (0, http_1.sendJson)(res, 400, { error: "Invalid damage amount." });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    const maxHealth = player.maxHealth ?? gameDefaults_1.DEFAULT_PLAYER.maxHealth;
    const currentHealth = player.health ?? maxHealth;
    const nextHealth = Math.max(0, currentHealth - amount);
    const wasAlive = currentHealth > 0;
    const diedNow = wasAlive && nextHealth === 0;
    player.health = nextHealth;
    player.lastHealthAt = new Date();
    let death;
    if (diedNow) {
        const resources = { ...gameDefaults_1.DEFAULT_PLAYER.resources, ...player.resources };
        const tokens = Number(resources.tokens ?? 0) || 0;
        const exp = Number(player.exp ?? 0) || 0;
        const tokenPercent = Math.max(1, Math.floor(Math.random() * 30) + 1) / 100;
        const expPercent = Math.max(1, Math.floor(Math.random() * 30) + 1) / 100;
        let lostTokens = Math.floor(tokens * tokenPercent);
        let lostExp = Math.floor(exp * expPercent);
        if (tokens > 0 && lostTokens === 0) {
            lostTokens = 1;
        }
        if (exp > 0 && lostExp === 0) {
            lostExp = 1;
        }
        resources.tokens = Math.max(0, tokens - lostTokens);
        player.resources = resources;
        player.exp = Math.max(0, exp - lostExp);
        death = { lostTokens, lostExp };
    }
    // Persist per-form health/exp progression (otherwise it can snap back to the
    // last saved monsterProgress entry and look like HP "doesn't subtract").
    const choice = user.shipChoice;
    if (choice) {
        const progress = (player.monsterProgress ?? {});
        const existing = progress[choice] ?? {
            level: player.level ?? 1,
            exp: player.exp ?? 0,
            expToNext: player.expToNext ?? 100,
            health: nextHealth,
            maxHealth: player.maxHealth ?? maxHealth,
            damage: player.damage ?? 12,
        };
        progress[choice] = {
            ...existing,
            level: player.level ?? existing.level,
            exp: player.exp ?? existing.exp,
            expToNext: player.expToNext ?? existing.expToNext,
            health: nextHealth,
            maxHealth: player.maxHealth ?? existing.maxHealth,
            damage: player.damage ?? existing.damage,
        };
        player.monsterProgress = progress;
    }
    await player.save();
    (0, http_1.sendJson)(res, 200, { player: player.toJSON(), death });
};
exports.handleDamagePlayer = handleDamagePlayer;
const handleUpgradeShelter = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    const resources = {
        ...gameDefaults_1.DEFAULT_PLAYER.resources,
        ...player.resources,
    };
    const cost = Math.round(12 * player.shelterLevel);
    if (resources.scrap < cost) {
        (0, http_1.sendJson)(res, 400, { error: "Not enough scrap." });
        return;
    }
    resources.scrap -= cost;
    player.resources = resources;
    player.shelterLevel += 1;
    await player.save();
    (0, http_1.sendJson)(res, 200, { player: player.toJSON() });
};
exports.handleUpgradeShelter = handleUpgradeShelter;
