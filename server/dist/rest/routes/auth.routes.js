"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChangePassword = exports.handleMe = exports.handleLogout = exports.handleRegister = exports.handleLogin = void 0;
const auth_1 = require("../auth");
const http_1 = require("../http");
const publicUser = (user) => ({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    shipChoice: user.shipChoice,
});
const handleLogin = async (req, res, ctx) => {
    const body = (await (0, http_1.readJsonBody)(req));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!email || !password) {
        (0, http_1.sendJson)(res, 400, { error: "Invalid credentials." });
        return;
    }
    const user = await ctx.db.User.findOne({ where: { email } });
    if (!user || !(0, auth_1.verifyPassword)(password, user.passwordHash)) {
        (0, http_1.sendJson)(res, 401, { error: "Wrong email or password." });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const session = await (0, auth_1.createSession)(ctx.db, user.id);
    (0, http_1.sendJson)(res, 200, { user: publicUser(user) }, [
        (0, http_1.sessionCookieHeader)(session.token, session.expiresAt),
    ]);
};
exports.handleLogin = handleLogin;
const handleRegister = async (req, res, ctx) => {
    const body = (await (0, http_1.readJsonBody)(req));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!email || password.length < 4) {
        (0, http_1.sendJson)(res, 400, { error: "Invalid credentials." });
        return;
    }
    const existing = await ctx.db.User.findOne({ where: { email } });
    if (existing) {
        (0, http_1.sendJson)(res, 409, { error: "Email already used." });
        return;
    }
    const user = await ctx.db.User.create({
        email,
        passwordHash: (0, auth_1.hashPassword)(password),
        nickname: null,
        shipChoice: null,
        musicVolume: 0.45,
        sfxVolume: 0.55,
    });
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "Failed to create user." });
        return;
    }
    const session = await (0, auth_1.createSession)(ctx.db, user.id);
    (0, http_1.sendJson)(res, 200, { user: publicUser(user) }, [
        (0, http_1.sessionCookieHeader)(session.token, session.expiresAt),
    ]);
};
exports.handleRegister = handleRegister;
const handleLogout = async (req, res, ctx) => {
    const token = ctx.db.parseCookies(req.headers.cookie).session;
    await (0, auth_1.revokeSession)(ctx.db, token);
    (0, http_1.sendJson)(res, 200, { ok: true }, [(0, http_1.sessionClearCookieHeader)()]);
};
exports.handleLogout = handleLogout;
const handleMe = async (req, res, ctx) => {
    const token = ctx.db.parseCookies(req.headers.cookie).session;
    const user = await (0, auth_1.getUserFromSession)(ctx.db, token);
    if (!user) {
        (0, http_1.sendJson)(res, 200, { user: null });
        return;
    }
    if (!user.id) {
        (0, http_1.sendJson)(res, 500, { error: "User ID not found." });
        return;
    }
    const nextExpiry = await (0, auth_1.refreshSession)(ctx.db, token);
    (0, http_1.sendJson)(res, 200, {
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
    }, nextExpiry && token
        ? [(0, http_1.sessionCookieHeader)(token, nextExpiry)]
        : undefined);
};
exports.handleMe = handleMe;
const handleChangePassword = async (req, res, ctx, auth) => {
    if (!auth) {
        (0, http_1.sendJson)(res, 401, { error: "Unauthorized." });
        return;
    }
    const user = auth.user;
    const body = (await (0, http_1.readJsonBody)(req));
    const oldPassword = String(body?.oldPassword ?? "");
    const oldPasswordRepeat = String(body?.oldPasswordRepeat ?? "");
    const newPassword = String(body?.newPassword ?? "");
    if (!oldPassword || !oldPasswordRepeat || !newPassword) {
        (0, http_1.sendJson)(res, 400, { error: "Missing fields." });
        return;
    }
    if (oldPassword !== oldPasswordRepeat) {
        (0, http_1.sendJson)(res, 400, { error: "Old passwords do not match." });
        return;
    }
    if (newPassword.length < 4) {
        (0, http_1.sendJson)(res, 400, { error: "New password is too short." });
        return;
    }
    if (!(0, auth_1.verifyPassword)(oldPassword, user.passwordHash)) {
        (0, http_1.sendJson)(res, 401, { error: "Wrong old password." });
        return;
    }
    user.passwordHash = (0, auth_1.hashPassword)(newPassword);
    await user.save();
    (0, http_1.sendJson)(res, 200, { ok: true });
};
exports.handleChangePassword = handleChangePassword;
