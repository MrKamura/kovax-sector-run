"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeSession = exports.refreshSession = exports.getUserFromSession = exports.createSession = exports.verifyPassword = exports.hashPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const hashPassword = (password) => {
    const salt = crypto_1.default.randomBytes(16).toString("hex");
    const hash = crypto_1.default
        .pbkdf2Sync(password, salt, 120000, 32, "sha256")
        .toString("hex");
    return `${salt}:${hash}`;
};
exports.hashPassword = hashPassword;
const verifyPassword = (password, stored) => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) {
        return false;
    }
    const attempt = crypto_1.default
        .pbkdf2Sync(password, salt, 120000, 32, "sha256")
        .toString("hex");
    return crypto_1.default.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
};
exports.verifyPassword = verifyPassword;
const createSession = async (db, userId) => {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.Session.create({ userId, token, expiresAt });
    return { token, expiresAt };
};
exports.createSession = createSession;
const getUserFromSession = async (db, token) => {
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
exports.getUserFromSession = getUserFromSession;
/** Sliding expiry: extends the session by a full TTL. */
const refreshSession = async (db, token) => {
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
exports.refreshSession = refreshSession;
const revokeSession = async (db, token) => {
    if (!token) {
        return;
    }
    await db.Session.destroy({ where: { token } });
};
exports.revokeSession = revokeSession;
