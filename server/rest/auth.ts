import crypto from "crypto";
import type { DbService } from "../game/game/db.service";
import type { UserModel } from "../game/models";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 32, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
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

export const createSession = async (
  db: DbService,
  userId: number
): Promise<{ token: string; expiresAt: Date }> => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.Session.create({ userId, token, expiresAt });
  return { token, expiresAt };
};

export const getUserFromSession = async (
  db: DbService,
  token: string | undefined
): Promise<UserModel | null> => {
  if (!token) {
    return null;
  }
  const session = await db.Session.findOne({ where: { token } });
  if (!session) {
    return null;
  }
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    await session.destroy();
    return null;
  }
  return db.User.findByPk(session.userId);
};

/** Sliding expiry: extends the session by a full TTL. */
export const refreshSession = async (
  db: DbService,
  token: string | undefined
): Promise<Date | null> => {
  if (!token) {
    return null;
  }
  const session = await db.Session.findOne({ where: { token } });
  if (!session) {
    return null;
  }
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  session.expiresAt = expiresAt;
  await session.save();
  return expiresAt;
};

export const revokeSession = async (
  db: DbService,
  token: string | undefined
): Promise<void> => {
  if (!token) {
    return;
  }
  await db.Session.destroy({ where: { token } });
};
