"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreatePlayer = exports.applyMutationCompletion = exports.statsForLevel = exports.expToNextLevel = void 0;
const gameDefaults_1 = require("../game/shared/gameDefaults");
const HEALTH_REGEN_INTERVAL_MS = 3000;
const BASE_MAX_HEALTH = 100;
const BASE_DAMAGE = 12;
const BASE_ENERGY_CAP = 10;
const ENERGY_PER_LEVEL = 3;
const MAX_PLAYER_LEVEL = 100;
const clampLevel = (level) => {
    const n = Number(level);
    if (!Number.isFinite(n)) {
        return 1;
    }
    return Math.max(1, Math.min(MAX_PLAYER_LEVEL, n));
};
const expToNextLevel = (level) => 100 + Math.max(0, clampLevel(level) - 1) * 60;
exports.expToNextLevel = expToNextLevel;
const maxHealthForLevel = (level) => BASE_MAX_HEALTH + Math.max(0, clampLevel(level) - 1) * 8;
const damageForLevel = (level) => BASE_DAMAGE + Math.max(0, clampLevel(level) - 1) * 2;
const energyCapForLevel = (level) => BASE_ENERGY_CAP + Math.floor(Math.max(0, clampLevel(level) - 1) / ENERGY_PER_LEVEL);
const PLAYER_MONSTER_MODS = {
    keeper19: { maxHealth: 0.85, damage: 0.85 },
    keeper20: { maxHealth: 1.2, damage: 1.2 },
};
const statsForLevel = (level, shipChoice) => {
    const base = {
        maxHealth: maxHealthForLevel(level),
        damage: damageForLevel(level),
    };
    if (!shipChoice || !PLAYER_MONSTER_MODS[shipChoice]) {
        return base;
    }
    const mod = PLAYER_MONSTER_MODS[shipChoice];
    return {
        maxHealth: Math.round(base.maxHealth * mod.maxHealth),
        damage: Math.round(base.damage * mod.damage),
    };
};
exports.statsForLevel = statsForLevel;
const defaultMutationState = () => ({
    purchasedSkills: [],
    skillLevels: {},
    upgradeInProgress: null,
});
const REMOVED_SKILL_IDS = ["continuous_laser_super"];
/** Ensure mutations column exists; migrate existing players so current skills count as purchased. Remove discontinued skills. */
const ensureMutationState = async (player) => {
    const raw = player.get("mutations");
    const current = raw && Array.isArray(raw.purchasedSkills)
        ? {
            purchasedSkills: raw.purchasedSkills.filter((id) => !REMOVED_SKILL_IDS.includes(id)),
            skillLevels: raw.skillLevels && typeof raw.skillLevels === "object" ? raw.skillLevels : {},
            upgradeInProgress: raw.upgradeInProgress ?? null,
        }
        : defaultMutationState();
    const removedFromLevels = { ...current.skillLevels };
    for (const id of REMOVED_SKILL_IDS)
        delete removedFromLevels[id];
    const next = {
        purchasedSkills: current.purchasedSkills,
        skillLevels: removedFromLevels,
        upgradeInProgress: current.upgradeInProgress && !REMOVED_SKILL_IDS.includes(current.upgradeInProgress.skillId)
            ? current.upgradeInProgress
            : null,
    };
    const skillsOnlyPurchased = Array.from({ length: 9 }, (_, i) => next.purchasedSkills[i] ?? "");
    const existingSlots = Array.isArray(player.skills) ? player.skills : [];
    let changed = JSON.stringify(next) !== JSON.stringify({ ...current, skillLevels: removedFromLevels }) ||
        (!raw && next.purchasedSkills.length === 0 && Object.keys(next.skillLevels).length === 0);
    if (skillsOnlyPurchased.some((s, i) => (existingSlots[i] ?? "") !== s)) {
        player.set("skills", skillsOnlyPurchased);
        changed = true;
    }
    if (changed) {
        player.set("mutations", next);
        await player.save();
    }
};
/** Apply completed upgrade: if upgradeInProgress.endsAt <= now, level up and clear. */
const applyMutationCompletion = async (player) => {
    const raw = player.get("mutations");
    if (!raw?.upgradeInProgress)
        return false;
    const { skillId, endsAt } = raw.upgradeInProgress;
    if (endsAt > Date.now())
        return false;
    const levels = { ...(raw.skillLevels && typeof raw.skillLevels === "object" ? raw.skillLevels : {}) };
    levels[skillId] = Math.min(5, (levels[skillId] ?? 0) + 1);
    const next = {
        purchasedSkills: raw.purchasedSkills ?? [],
        skillLevels: levels,
        upgradeInProgress: null,
    };
    player.set("mutations", next);
    await player.save();
    return true;
};
exports.applyMutationCompletion = applyMutationCompletion;
const ensureHealthDefaults = async (player, shipChoice) => {
    let changed = false;
    if (player.level == null) {
        player.level = gameDefaults_1.DEFAULT_PLAYER.level;
        changed = true;
    }
    if (player.exp == null) {
        player.exp = gameDefaults_1.DEFAULT_PLAYER.exp;
        changed = true;
    }
    const level = clampLevel(player.level ?? gameDefaults_1.DEFAULT_PLAYER.level);
    if (player.level !== level) {
        player.level = level;
        changed = true;
    }
    const desiredExpToNext = (0, exports.expToNextLevel)(level);
    const stats = (0, exports.statsForLevel)(level, shipChoice);
    const desiredDamage = stats.damage;
    const desiredMaxHealth = stats.maxHealth;
    if (player.expToNext == null || player.expToNext !== desiredExpToNext) {
        player.expToNext = desiredExpToNext;
        changed = true;
    }
    if (player.damage == null || player.damage !== desiredDamage) {
        player.damage = desiredDamage;
        changed = true;
    }
    /* Skills are managed by the mutation system (purchase with tokens); do not overwrite here. */
    if (player.maxHealth == null || player.maxHealth !== desiredMaxHealth) {
        player.maxHealth = desiredMaxHealth;
        changed = true;
    }
    if (player.health == null) {
        player.health = player.maxHealth ?? gameDefaults_1.DEFAULT_PLAYER.maxHealth;
        changed = true;
    }
    if (player.lastHealthAt === undefined) {
        player.lastHealthAt = gameDefaults_1.DEFAULT_PLAYER.lastHealthAt;
        changed = true;
    }
    if (changed) {
        await player.save();
    }
};
const applyHealthRegen = async (player, shipChoice) => {
    await ensureHealthDefaults(player, shipChoice);
    const maxHealth = player.maxHealth ?? gameDefaults_1.DEFAULT_PLAYER.maxHealth;
    const health = player.health ?? maxHealth;
    // IMPORTANT: never "revive" a dead player via passive regen.
    // Respawn must be an explicit action (OK button).
    if (health <= 0) {
        return;
    }
    if (health >= maxHealth) {
        return;
    }
    const now = Date.now();
    const last = player.lastHealthAt
        ? new Date(player.lastHealthAt).getTime()
        : now;
    const elapsed = now - last;
    if (elapsed < HEALTH_REGEN_INTERVAL_MS) {
        return;
    }
    const regen = Math.floor(elapsed / HEALTH_REGEN_INTERVAL_MS);
    const nextHealth = Math.min(maxHealth, health + regen);
    player.health = nextHealth;
    player.lastHealthAt = new Date(now);
    if (shipChoice) {
        const progress = (player.monsterProgress ?? {});
        if (progress[shipChoice]) {
            progress[shipChoice] = { ...progress[shipChoice], health: nextHealth };
            player.monsterProgress = progress;
        }
    }
    await player.save();
};
const ensureMonsterProgress = async (player, shipChoice) => {
    if (!shipChoice) {
        return;
    }
    const progress = (player.monsterProgress ?? {});
    const existingRaw = progress[shipChoice];
    const rawLevel = Number(existingRaw?.level);
    const level = Number.isFinite(rawLevel) && rawLevel > 0
        ? clampLevel(rawLevel)
        : (player.level ?? gameDefaults_1.DEFAULT_PLAYER.level);
    const rawExp = Number(existingRaw?.exp);
    const exp = Number.isFinite(rawExp) && rawExp >= 0 ? rawExp : (player.exp ?? gameDefaults_1.DEFAULT_PLAYER.exp);
    const rawExpToNext = Number(existingRaw?.expToNext);
    const expToNext = Number.isFinite(rawExpToNext) && rawExpToNext > 0
        ? rawExpToNext
        : (0, exports.expToNextLevel)(level);
    const stats = (0, exports.statsForLevel)(level, shipChoice);
    const rawMaxHealth = Number(existingRaw?.maxHealth);
    const maxHealth = Number.isFinite(rawMaxHealth) && rawMaxHealth > 0
        ? rawMaxHealth
        : stats.maxHealth;
    const rawDamage = Number(existingRaw?.damage);
    const damage = Number.isFinite(rawDamage) && rawDamage > 0 ? rawDamage : stats.damage;
    // IMPORTANT: treat the DB `player.health` as canonical to avoid other API calls
    // (collect/craft/etc.) snapping health back to a stale monsterProgress value.
    const dbHealthRaw = Number(player.health);
    const rawHealth = Number(existingRaw?.health);
    const fallbackHealth = player.health ?? maxHealth;
    const chosenHealthRaw = Number.isFinite(dbHealthRaw)
        ? dbHealthRaw
        : Number.isFinite(rawHealth)
            ? rawHealth
            : Number(fallbackHealth);
    const health = Math.max(0, Math.min(maxHealth, chosenHealthRaw));
    const nextProgress = {
        ...progress,
        [shipChoice]: { level, exp, expToNext, health, maxHealth, damage },
    };
    let changed = false;
    if (player.level !== level) {
        player.level = level;
        changed = true;
    }
    if (player.exp !== exp) {
        player.exp = exp;
        changed = true;
    }
    if (player.expToNext !== expToNext) {
        player.expToNext = expToNext;
        changed = true;
    }
    if (player.maxHealth !== maxHealth) {
        player.maxHealth = maxHealth;
        changed = true;
    }
    if (player.damage !== damage) {
        player.damage = damage;
        changed = true;
    }
    if (player.health !== health) {
        player.health = health;
        changed = true;
    }
    if (player.monsterProgress !== nextProgress) {
        player.monsterProgress = nextProgress;
        changed = true;
    }
    if (changed) {
        await player.save();
    }
};
const getOrCreatePlayer = async (db, userId, shipChoice, options) => {
    const applyRegen = options?.applyRegen === true;
    const existing = await db.Player.findOne({ where: { userId } });
    if (existing) {
        await ensureMutationState(existing);
        await (0, exports.applyMutationCompletion)(existing);
        await ensureMonsterProgress(existing, shipChoice);
        if (applyRegen) {
            await applyHealthRegen(existing, shipChoice);
        }
        return existing;
    }
    const level = gameDefaults_1.DEFAULT_PLAYER.level ?? 1;
    const resources = {
        ...gameDefaults_1.DEFAULT_PLAYER.resources,
        scrap: energyCapForLevel(level),
        tokens: 0,
    };
    const created = await db.Player.create({
        ...gameDefaults_1.DEFAULT_PLAYER,
        resources,
        userId,
        lastCollectedAt: null,
        monsterProgress: {},
        skills: [], // Mutation: skills are purchased with tokens; panel starts empty
        mutations: defaultMutationState(),
    });
    await ensureMonsterProgress(created, shipChoice);
    if (applyRegen) {
        await applyHealthRegen(created, shipChoice);
    }
    return created;
};
exports.getOrCreatePlayer = getOrCreatePlayer;
