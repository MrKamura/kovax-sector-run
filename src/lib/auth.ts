import crypto from "crypto";
import { initModels, Session, User } from "./modelInit";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 32, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }
  const attempt = crypto
    .pbkdf2Sync(password, salt, 120000, 32, "sha256")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(attempt, "hex")
  );
};

export const createSession = async (userId: number) => {
  await initModels();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ userId, token, expiresAt });
  return { token, expiresAt };
};

export const getUserFromSession = async (token: string | undefined) => {
  if (!token) {
    return null;
  }
  await initModels();
  const session = await Session.findOne({ where: { token } });
  if (!session) {
    return null;
  }
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    await session.destroy();
    return null;
  }
  return User.findByPk(session.userId);
};

export const refreshSession = async (token: string | undefined) => {
  if (!token) {
    return null;
  }
  await initModels();
  const session = await Session.findOne({ where: { token } });
  if (!session) {
    return null;
  }
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  session.expiresAt = expiresAt;
  await session.save();
  return expiresAt;
};

export const revokeSession = async (token: string | undefined) => {
  if (!token) {
    return;
  }
  await initModels();
  await Session.destroy({ where: { token } });
};

export const ensureModels = async () => {
  await initModels();
};
