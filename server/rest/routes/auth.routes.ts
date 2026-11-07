import type { IncomingMessage, ServerResponse } from "http";
import type { UserModel } from "../../game/models";
import type { RestAuth, RestContext } from "../router";
import {
  createSession,
  getUserFromSession,
  hashPassword,
  refreshSession,
  revokeSession,
  verifyPassword,
} from "../auth";
import {
  readJsonBody,
  sendJson,
  sessionClearCookieHeader,
  sessionCookieHeader,
} from "../http";

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RestContext,
  auth: RestAuth | null
) => Promise<void>;

const publicUser = (user: UserModel) => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  shipChoice: user.shipChoice,
});

export const handleLogin: Handler = async (req, res, ctx) => {
  const body = (await readJsonBody(req)) as { email?: unknown; password?: unknown } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    sendJson(res, 400, { error: "Invalid credentials." });
    return;
  }
  const user = await ctx.db.User.findOne({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    sendJson(res, 401, { error: "Wrong email or password." });
    return;
  }
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  const session = await createSession(ctx.db, user.id);
  sendJson(res, 200, { user: publicUser(user) }, [
    sessionCookieHeader(session.token, session.expiresAt),
  ]);
};

export const handleRegister: Handler = async (req, res, ctx) => {
  const body = (await readJsonBody(req)) as { email?: unknown; password?: unknown } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || password.length < 4) {
    sendJson(res, 400, { error: "Invalid credentials." });
    return;
  }
  const existing = await ctx.db.User.findOne({ where: { email } });
  if (existing) {
    sendJson(res, 409, { error: "Email already used." });
    return;
  }
  const user = await ctx.db.User.create({
    email,
    passwordHash: hashPassword(password),
    nickname: null,
    shipChoice: null,
    musicVolume: 0.45,
    sfxVolume: 0.55,
  });
  if (!user.id) {
    sendJson(res, 500, { error: "Failed to create user." });
    return;
  }
  const session = await createSession(ctx.db, user.id);
  sendJson(res, 200, { user: publicUser(user) }, [
    sessionCookieHeader(session.token, session.expiresAt),
  ]);
};

export const handleLogout: Handler = async (req, res, ctx) => {
  const token = ctx.db.parseCookies(req.headers.cookie).session;
  await revokeSession(ctx.db, token);
  sendJson(res, 200, { ok: true }, [sessionClearCookieHeader()]);
};

export const handleMe: Handler = async (req, res, ctx) => {
  const token = ctx.db.parseCookies(req.headers.cookie).session;
  const user = await getUserFromSession(ctx.db, token);
  if (!user) {
    sendJson(res, 200, { user: null });
    return;
  }
  if (!user.id) {
    sendJson(res, 500, { error: "User ID not found." });
    return;
  }
  const nextExpiry = await refreshSession(ctx.db, token);
  sendJson(
    res,
    200,
    {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        shipChoice: user.shipChoice,
        musicVolume: Number(user.musicVolume ?? 0.45),
        sfxVolume: Number(user.sfxVolume ?? 0.55),
        chatPositionX: user.chatPositionX ?? null,
        chatPositionY: user.chatPositionY ?? null,
        chatWidth: user.chatWidth ?? null,
        chatHeight: user.chatHeight ?? null,
        chatOpacity: user.chatOpacity ?? null,
      },
    },
    nextExpiry && token
      ? [sessionCookieHeader(token, nextExpiry)]
      : undefined
  );
};

export const handleChangePassword: Handler = async (req, res, ctx, auth) => {
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized." });
    return;
  }
  const user = auth.user;
  const body = (await readJsonBody(req)) as {
    oldPassword?: unknown;
    oldPasswordRepeat?: unknown;
    newPassword?: unknown;
  } | null;
  const oldPassword = String(body?.oldPassword ?? "");
  const oldPasswordRepeat = String(body?.oldPasswordRepeat ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (!oldPassword || !oldPasswordRepeat || !newPassword) {
    sendJson(res, 400, { error: "Missing fields." });
    return;
  }
  if (oldPassword !== oldPasswordRepeat) {
    sendJson(res, 400, { error: "Old passwords do not match." });
    return;
  }
  if (newPassword.length < 4) {
    sendJson(res, 400, { error: "New password is too short." });
    return;
  }
  if (!verifyPassword(oldPassword, user.passwordHash)) {
    sendJson(res, 401, { error: "Wrong old password." });
    return;
  }

  user.passwordHash = hashPassword(newPassword);
  await user.save();

  sendJson(res, 200, { ok: true });
};
