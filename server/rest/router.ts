import type { IncomingMessage, ServerResponse } from "http";
import type { DbService } from "../game/game/db.service";
import type { UserModel } from "../game/models";
import { getUserFromSession } from "./auth";
import { sendJson } from "./http";
import {
  handleChangePassword,
  handleLogin,
  handleLogout,
  handleMe,
  handleRegister,
} from "./routes/auth.routes";
import { handleNickname, handleSettings, handleShip } from "./routes/user.routes";
import {
  handleCollect,
  handleConsumeEnergy,
  handleCraft,
  handleDamagePlayer,
  handlePlayerGet,
  handleUpgradeShelter,
} from "./routes/player.routes";
import { handleMutation, handleSkills } from "./routes/skill.routes";

export type RestContext = { db: DbService };

/** Authenticated session for a REST request (null when unauthenticated). */
export type RestAuth = { user: UserModel; token: string };

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RestContext,
  auth: RestAuth | null
) => Promise<void>;

type Route = { path: string; method: string; handler: RouteHandler };

const ROUTES: Route[] = [
  { path: "/api/auth/login", method: "POST", handler: handleLogin },
  { path: "/api/auth/register", method: "POST", handler: handleRegister },
  { path: "/api/auth/logout", method: "POST", handler: handleLogout },
  { path: "/api/auth/me", method: "GET", handler: handleMe },
  { path: "/api/auth/change-password", method: "POST", handler: handleChangePassword },
  { path: "/api/player", method: "GET", handler: handlePlayerGet },
  { path: "/api/collect", method: "POST", handler: handleCollect },
  { path: "/api/consume-energy", method: "POST", handler: handleConsumeEnergy },
  { path: "/api/craft", method: "POST", handler: handleCraft },
  { path: "/api/damage-player", method: "POST", handler: handleDamagePlayer },
  { path: "/api/upgrade-shelter", method: "POST", handler: handleUpgradeShelter },
  { path: "/api/mutation", method: "GET", handler: handleMutation },
  { path: "/api/mutation", method: "POST", handler: handleMutation },
  { path: "/api/skills", method: "POST", handler: handleSkills },
  { path: "/api/skills", method: "PUT", handler: handleSkills },
  { path: "/api/user/nickname", method: "POST", handler: handleNickname },
  { path: "/api/user/settings", method: "POST", handler: handleSettings },
  { path: "/api/user/ship", method: "POST", handler: handleShip },
];

const resolveAuth = async (
  ctx: RestContext,
  req: IncomingMessage
): Promise<RestAuth | null> => {
  const token = ctx.db.parseCookies(req.headers.cookie).session;
  if (!token) {
    return null;
  }
  const user = await getUserFromSession(ctx.db, token);
  return user ? { user, token } : null;
};

/** Plain HTTP router for the game REST API (`/api/*`), served before the client UI. */
export const createRestRouter =
  (ctx: RestContext) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = (req.url ?? "/").split("?")[0];
    const method = (req.method ?? "GET").toUpperCase();
    try {
      const route = ROUTES.find((r) => r.path === path && r.method === method);
      if (!route) {
        sendJson(res, 404, { error: "Not found." });
        return;
      }
      const auth = await resolveAuth(ctx, req);
      await route.handler(req, res, ctx, auth);
    } catch (err) {
      console.error(`[rest] ${method} ${path} failed:`, err);
      sendJson(res, 500, { error: "Internal server error." });
    }
  };
