import type { IncomingMessage, ServerResponse } from "http";
import type { RestAuth, RestContext } from "../router";
import { getOrCreatePlayer, expToNextLevel, statsForLevel } from "../playerRepo";
import { readJsonBody, sendJson } from "../http";

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RestContext,
  auth: RestAuth | null
) => Promise<void>;

const publicUser = (user: {
  id: number;
  email: string;
  nickname: string | null;
  shipChoice: string | null;
}) => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  shipChoice: user.shipChoice,
});

export const handleNickname: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as { nickname?: unknown } | null;
  const nickname = String(body?.nickname ?? "").trim();
  if (!nickname || nickname.length < 3) {
    sendJson(res, 400, { error: "Nickname too short." });
    return;
  }
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  const existing = await ctx.db.User.findOne({ where: { nickname } });
  if (existing && existing.id !== user.id) {
    sendJson(res, 409, { error: "Ник уже занят." });
    return;
  }
  user.nickname = nickname;
  await user.save();
  sendJson(res, 200, { user: publicUser(user) });
};

export const handleSettings: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as {
    musicVolume?: unknown;
    sfxVolume?: unknown;
    chatPosition?: { x?: unknown; y?: unknown } | null;
    chatSize?: { width?: unknown; height?: unknown } | null;
    chatOpacity?: unknown;
  } | null;
  const musicVolumeRaw = body?.musicVolume;
  const sfxVolumeRaw = body?.sfxVolume;
  const chatPositionRaw = body?.chatPosition;
  const chatSizeRaw = body?.chatSize;
  const chatOpacityRaw = body?.chatOpacity;

  const nextMusic =
    musicVolumeRaw == null ? null : Math.max(0, Math.min(1, Number(musicVolumeRaw) || 0));
  const nextSfx =
    sfxVolumeRaw == null ? null : Math.max(0, Math.min(1, Number(sfxVolumeRaw) || 0));

  if (nextMusic == null && nextSfx == null && chatPositionRaw == null && chatSizeRaw == null && chatOpacityRaw == null) {
    sendJson(res, 400, { error: "No settings provided." });
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

  sendJson(res, 200, {
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

const ALLOWED_SHIPS = ["keeper19", "keeper20"] as const;

export const handleShip: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as { ship?: unknown } | null;
  const ship = body?.ship as (typeof ALLOWED_SHIPS)[number] | undefined;
  if (!ship || !ALLOWED_SHIPS.includes(ship)) {
    sendJson(res, 400, { error: "Unknown monster choice." });
    return;
  }
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  const previousChoice = user.shipChoice;
  const player = await getOrCreatePlayer(ctx.db, user.id, previousChoice);
  const progress = (player.monsterProgress ?? {}) as Record<
    string,
    {
      level: number;
      exp: number;
      expToNext: number;
      health: number;
      maxHealth: number;
      damage: number;
    }
  >;
  if (previousChoice) {
    const prevLevel = player.level ?? 1;
    const prevStats = statsForLevel(prevLevel, previousChoice);
    progress[previousChoice] = {
      level: prevLevel,
      exp: player.exp ?? 0,
      expToNext: player.expToNext ?? expToNextLevel(prevLevel),
      health: player.health ?? prevStats.maxHealth,
      maxHealth: player.maxHealth ?? prevStats.maxHealth,
      damage: player.damage ?? prevStats.damage,
    };
  }
  if (!progress[ship]) {
    const baseLevel = 1;
    const stats = statsForLevel(baseLevel, ship);
    progress[ship] = {
      level: baseLevel,
      exp: 0,
      expToNext: expToNextLevel(baseLevel),
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
  sendJson(res, 200, { user: publicUser(user) });
};
