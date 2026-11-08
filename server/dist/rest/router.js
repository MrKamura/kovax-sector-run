"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRestRouter = void 0;
const auth_1 = require("./auth");
const http_1 = require("./http");
const auth_routes_1 = require("./routes/auth.routes");
const user_routes_1 = require("./routes/user.routes");
const player_routes_1 = require("./routes/player.routes");
const skill_routes_1 = require("./routes/skill.routes");
const ROUTES = [
    { path: "/api/auth/login", method: "POST", handler: auth_routes_1.handleLogin },
    { path: "/api/auth/register", method: "POST", handler: auth_routes_1.handleRegister },
    { path: "/api/auth/logout", method: "POST", handler: auth_routes_1.handleLogout },
    { path: "/api/auth/me", method: "GET", handler: auth_routes_1.handleMe },
    { path: "/api/auth/change-password", method: "POST", handler: auth_routes_1.handleChangePassword },
    { path: "/api/player", method: "GET", handler: player_routes_1.handlePlayerGet },
    { path: "/api/collect", method: "POST", handler: player_routes_1.handleCollect },
    { path: "/api/consume-energy", method: "POST", handler: player_routes_1.handleConsumeEnergy },
    { path: "/api/craft", method: "POST", handler: player_routes_1.handleCraft },
    { path: "/api/damage-player", method: "POST", handler: player_routes_1.handleDamagePlayer },
    { path: "/api/upgrade-shelter", method: "POST", handler: player_routes_1.handleUpgradeShelter },
    { path: "/api/mutation", method: "GET", handler: skill_routes_1.handleMutation },
    { path: "/api/mutation", method: "POST", handler: skill_routes_1.handleMutation },
    { path: "/api/skills", method: "POST", handler: skill_routes_1.handleSkills },
    { path: "/api/skills", method: "PUT", handler: skill_routes_1.handleSkills },
    { path: "/api/user/nickname", method: "POST", handler: user_routes_1.handleNickname },
    { path: "/api/user/settings", method: "POST", handler: user_routes_1.handleSettings },
    { path: "/api/user/ship", method: "POST", handler: user_routes_1.handleShip },
];
const resolveAuth = async (ctx, req) => {
    const token = ctx.db.parseCookies(req.headers.cookie).session;
    if (!token) {
        return null;
    }
    const user = await (0, auth_1.getUserFromSession)(ctx.db, token);
    return user ? { user, token } : null;
};
/** Plain HTTP router for the game REST API (`/api/*`), served before the client UI. */
const createRestRouter = (ctx) => async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const method = (req.method ?? "GET").toUpperCase();
    try {
        const route = ROUTES.find((r) => r.path === path && r.method === method);
        if (!route) {
            (0, http_1.sendJson)(res, 404, { error: "Not found." });
            return;
        }
        const auth = await resolveAuth(ctx, req);
        await route.handler(req, res, ctx, auth);
    }
    catch (err) {
        console.error(`[rest] ${method} ${path} failed:`, err);
        (0, http_1.sendJson)(res, 500, { error: "Internal server error." });
    }
};
exports.createRestRouter = createRestRouter;
