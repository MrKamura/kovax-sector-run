"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSkills = exports.handleMutation = void 0;
const playerRepo_1 = require("../playerRepo");
const mutation_1 = require("../../game/shared/mutation");
const http_1 = require("../http");
const getMutationState = (player) => {
    const raw = player.get("mutations");
    if (!raw || !Array.isArray(raw.purchasedSkills)) {
        return { purchasedSkills: [], skillLevels: {}, upgradeInProgress: null };
    }
    return {
        purchasedSkills: raw.purchasedSkills,
        skillLevels: raw.skillLevels && typeof raw.skillLevels === "object" ? raw.skillLevels : {},
        upgradeInProgress: raw.upgradeInProgress ?? null,
    };
};
const handleMutation = async (req, res, ctx, auth) => {
    if (!auth?.user.id) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    if (req.method === "GET") {
        const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
        await (0, playerRepo_1.applyMutationCompletion)(player);
        const mutations = getMutationState(player);
        const resources = player.resources ?? { scrap: 0, tokens: 0 };
        const tokens = Number(resources.tokens ?? 0) || 0;
        (0, http_1.sendJson)(res, 200, {
            mutations,
            tokens,
            player: player.toJSON(),
        });
        return;
    }
    // POST
    const body = (await (0, http_1.readJsonBody)(req));
    const action = body?.action === "purchase" ? "purchase" : body?.action === "upgrade" ? "upgrade" : null;
    const skillId = typeof body?.skillId === "string" ? body.skillId.trim().slice(0, 40) : "";
    if (!action || !skillId) {
        (0, http_1.sendJson)(res, 400, {
            error: "action (purchase|upgrade) and skillId are required.",
        });
        return;
    }
    if (!mutation_1.MUTATION_SKILL_IDS.includes(skillId)) {
        (0, http_1.sendJson)(res, 400, { error: "Unknown skill." });
        return;
    }
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    await (0, playerRepo_1.applyMutationCompletion)(player);
    const mutations = getMutationState(player);
    const resources = player.resources ?? { scrap: 0, tokens: 0 };
    let tokens = Number(resources.tokens ?? 0) || 0;
    if (action === "purchase") {
        const currentLevel = Math.max(0, mutations.skillLevels[skillId] ?? 0);
        if (currentLevel >= 1) {
            (0, http_1.sendJson)(res, 400, { error: "Навык уже куплен." });
            return;
        }
        const level1Cost = (0, mutation_1.getSkillLevelCost)(skillId, 1);
        if (!level1Cost) {
            (0, http_1.sendJson)(res, 400, { error: "Invalid skill or level." });
            return;
        }
        if (tokens < level1Cost.tokens) {
            (0, http_1.sendJson)(res, 400, {
                error: `Недостаточно токенов. Нужно: ${level1Cost.tokens}.`,
            });
            return;
        }
        tokens -= level1Cost.tokens;
        const nextPurchased = [...mutations.purchasedSkills, skillId];
        const nextLevels = { ...mutations.skillLevels, [skillId]: 1 };
        player.set("resources", { ...resources, tokens });
        player.set("mutations", {
            purchasedSkills: nextPurchased,
            skillLevels: nextLevels,
            upgradeInProgress: mutations.upgradeInProgress,
        });
        await player.save();
        (0, http_1.sendJson)(res, 200, {
            mutations: getMutationState(player),
            tokens,
            player: player.toJSON(),
        });
        return;
    }
    // action === "upgrade"
    const currentLevel = Math.max(0, Math.min(mutation_1.MUTATION_MAX_LEVEL, mutations.skillLevels[skillId] ?? 0));
    if (currentLevel < 1) {
        (0, http_1.sendJson)(res, 400, { error: "Сначала купите навык (уровень 1)." });
        return;
    }
    if (currentLevel >= mutation_1.MUTATION_MAX_LEVEL) {
        (0, http_1.sendJson)(res, 400, { error: "Навык уже максимального уровня." });
        return;
    }
    if (mutations.upgradeInProgress) {
        (0, http_1.sendJson)(res, 400, {
            error: "Один навык уже улучшается. Дождитесь окончания.",
        });
        return;
    }
    const nextLevel = currentLevel + 1;
    const levelCost = (0, mutation_1.getSkillLevelCost)(skillId, nextLevel);
    if (!levelCost) {
        (0, http_1.sendJson)(res, 400, { error: "Invalid level." });
        return;
    }
    if (tokens < levelCost.tokens) {
        (0, http_1.sendJson)(res, 400, {
            error: `Недостаточно токенов. Нужно: ${levelCost.tokens}.`,
        });
        return;
    }
    tokens -= levelCost.tokens;
    const nextLevels = { ...mutations.skillLevels, [skillId]: nextLevel };
    if (levelCost.durationMs <= 0) {
        player.set("resources", { ...resources, tokens });
        player.set("mutations", {
            purchasedSkills: mutations.purchasedSkills,
            skillLevels: nextLevels,
            upgradeInProgress: null,
        });
        await player.save();
        (0, http_1.sendJson)(res, 200, {
            mutations: getMutationState(player),
            tokens,
            player: player.toJSON(),
        });
        return;
    }
    const endsAt = Date.now() + levelCost.durationMs;
    player.set("resources", { ...resources, tokens });
    player.set("mutations", {
        purchasedSkills: mutations.purchasedSkills,
        skillLevels: mutations.skillLevels,
        upgradeInProgress: { skillId, endsAt },
    });
    await player.save();
    (0, http_1.sendJson)(res, 200, {
        mutations: getMutationState(player),
        tokens,
        player: player.toJSON(),
    });
};
exports.handleMutation = handleMutation;
const handleSkills = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    if (req.method === "POST") {
        const body = (await (0, http_1.readJsonBody)(req));
        const rawSkill = String(body?.skill ?? "").trim();
        if (!rawSkill) {
            (0, http_1.sendJson)(res, 400, { error: "Skill is required." });
            return;
        }
        const skill = rawSkill.slice(0, 40);
        if (!user.id) {
            (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
            return;
        }
        const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
        const mutations = player.get("mutations");
        const purchased = new Set(mutations?.purchasedSkills ?? []);
        if (!purchased.has(skill)) {
            (0, http_1.sendJson)(res, 400, {
                error: "Навык нужно сначала купить в разделе Мутации.",
            });
            return;
        }
        const skills = Array.from(Array.isArray(player.skills) ? player.skills : [], (s) => s || "");
        const filled = skills.slice(0, 9);
        while (filled.length < 9)
            filled.push("");
        if (!filled.includes(skill)) {
            const idx = filled.indexOf("");
            if (idx !== -1)
                filled[idx] = skill;
            player.skills = filled;
            await player.save();
        }
        (0, http_1.sendJson)(res, 200, { player: player.toJSON() });
        return;
    }
    // PUT
    const body = (await (0, http_1.readJsonBody)(req));
    const raw = body?.skills;
    if (!Array.isArray(raw)) {
        (0, http_1.sendJson)(res, 400, {
            error: "skills array is required.",
        });
        return;
    }
    const skills = Array.from({ length: 9 }, (_, i) => {
        const s = raw[i];
        return s != null && String(s).trim() ? String(s).trim().slice(0, 40) : "";
    });
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, user.shipChoice);
    const mutations = player.get("mutations");
    const purchased = new Set(mutations?.purchasedSkills ?? []);
    const validSkills = skills.map((id) => (id && purchased.has(id) ? id : ""));
    player.skills = validSkills;
    await player.save();
    (0, http_1.sendJson)(res, 200, { player: player.toJSON() });
};
exports.handleSkills = handleSkills;
