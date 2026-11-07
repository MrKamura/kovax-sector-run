"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleShip = exports.handleSettings = exports.handleNickname = void 0;
const playerRepo_1 = require("../playerRepo");
const http_1 = require("../http");
const publicUser = (user) => ({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    shipChoice: user.shipChoice,
});
const handleNickname = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const nickname = String(body?.nickname ?? "").trim();
    if (!nickname || nickname.length < 3) {
        (0, http_1.sendJson)(res, 400, { error: "Nickname too short." });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const existing = await ctx.db.User.findOne({ where: { nickname } });
    if (existing && existing.id !== user.id) {
        (0, http_1.sendJson)(res, 409, { error: "Ник уже занят." });
        return;
    }
    user.nickname = nickname;
    await user.save();
    (0, http_1.sendJson)(res, 200, { user: publicUser(user) });
};
exports.handleNickname = handleNickname;
const handleSettings = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const musicVolumeRaw = body?.musicVolume;
    const sfxVolumeRaw = body?.sfxVolume;
    const chatPositionRaw = body?.chatPosition;
    const chatSizeRaw = body?.chatSize;
    const chatOpacityRaw = body?.chatOpacity;
    const nextMusic = musicVolumeRaw == null ? null : Math.max(0, Math.min(1, Number(musicVolumeRaw) || 0));
    const nextSfx = sfxVolumeRaw == null ? null : Math.max(0, Math.min(1, Number(sfxVolumeRaw) || 0));
    if (nextMusic == null && nextSfx == null && chatPositionRaw == null && chatSizeRaw == null && chatOpacityRaw == null) {
        (0, http_1.sendJson)(res, 400, { error: "No settings provided." });
        return;
    }
    if (nextMusic != null) {
        user.musicVolume = nextMusic;
    }
    if (nextSfx != null) {
        user.sfxVolume = nextSfx;
    }
    if (chatPositionRaw != null) {
        const x = Number(chatPositionRaw.x);
        const y = Number(chatPositionRaw.y);
        if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0) {
            user.chatPositionX = Math.round(x);
            user.chatPositionY = Math.round(y);
        }
    }
    if (chatSizeRaw != null) {
        const width = Number(chatSizeRaw.width);
        const height = Number(chatSizeRaw.height);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            user.chatWidth = Math.round(width);
            user.chatHeight = Math.round(height);
        }
    }
    if (chatOpacityRaw != null) {
        const opacity = Number(chatOpacityRaw);
        if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) {
            user.chatOpacity = opacity;
        }
    }
    await user.save();
    (0, http_1.sendJson)(res, 200, {
        user: {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            shipChoice: user.shipChoice,
            musicVolume: Number(user.musicVolume ?? 0.45),
            sfxVolume: Number(user.sfxVolume ?? 0.55),
        },
    });
};
exports.handleSettings = handleSettings;
const ALLOWED_SHIPS = ["keeper19", "keeper20"];
const handleShip = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const ship = body?.ship;
    if (!ship || !ALLOWED_SHIPS.includes(ship)) {
        (0, http_1.sendJson)(res, 400, { error: "Unknown monster choice." });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const previousChoice = user.shipChoice;
    const player = await (0, playerRepo_1.getOrCreatePlayer)(ctx.db, user.id, previousChoice);
    const progress = (player.monsterProgress ?? {});
    if (previousChoice) {
        const prevLevel = player.level ?? 1;
        const prevStats = (0, playerRepo_1.statsForLevel)(prevLevel, previousChoice);
        progress[previousChoice] = {
            level: prevLevel,
            exp: player.exp ?? 0,
            expToNext: player.expToNext ?? (0, playerRepo_1.expToNextLevel)(prevLevel),
            health: player.health ?? prevStats.maxHealth,
            maxHealth: player.maxHealth ?? prevStats.maxHealth,
            damage: player.damage ?? prevStats.damage,
        };
    }
    if (!progress[ship]) {
        const baseLevel = 1;
        const stats = (0, playerRepo_1.statsForLevel)(baseLevel, ship);
        progress[ship] = {
            level: baseLevel,
            exp: 0,
            expToNext: (0, playerRepo_1.expToNextLevel)(baseLevel),
            health: stats.maxHealth,
            maxHealth: stats.maxHealth,
            damage: stats.damage,
        };
    }
    const nextProgress = progress[ship];
    player.level = nextProgress.level;
    player.exp = nextProgress.exp;
    player.expToNext = nextProgress.expToNext;
    player.health = nextProgress.health;
    player.maxHealth = nextProgress.maxHealth;
    player.damage = nextProgress.damage;
    player.monsterProgress = progress;
    await player.save();
    user.shipChoice = ship;
    await user.save();
    (0, http_1.sendJson)(res, 200, { user: publicUser(user) });
};
exports.handleShip = handleShip;
