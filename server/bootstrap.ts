import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UnhandledRejection:", reason, promise);
  process.exit(1);
});

import http from "http";
import next from "next";
import { GameGateway } from "./game/game/game.gateway";
import { runWorldTick, createWorldTickState } from "./game/game/world-tick.service";
import { createGameServices } from "./container";
import { createRestRouter } from "./rest/router";
import { TICK_INTERVAL_MS } from "./game/config/constants";

const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";

function isDbConnectionError(error: unknown): boolean {
  const err = error as {
    name?: string;
    code?: string;
    message?: string;
    parent?: { code?: string };
  };
  return (
    err?.name === "SequelizeConnectionRefusedError" ||
    err?.code === "ECONNREFUSED" ||
    err?.parent?.code === "ECONNREFUSED" ||
    (err?.message ?? "").includes("ECONNREFUSED")
  );
}

async function bootstrap() {
  console.log("Bootstrap: starting Next.js...");
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  console.log("Bootstrap: Next.js ready");

  const upgradeHandler = app.getUpgradeHandler();

  console.log("Bootstrap: creating game services...");
  let services: ReturnType<typeof createGameServices>;
  try {
    services = createGameServices();
    await services.sectorService.loadSectorsFromDb(services.db);
  } catch (error) {
    if (isDbConnectionError(error)) {
      const dbUrl = (process.env.DATABASE_URL ?? "").replace(/:([^:@/]+)@/, ":***@");
      console.error(
        [
          "",
          "Could not connect to PostgreSQL (ECONNREFUSED) — the database server is not running.",
          `Database connection: ${dbUrl || "(DATABASE_URL is not set in .env.local)"}`,
          "",
          "Fix it (pick one), then re-run \"yarn dev\":",
          "  1. Start the Windows service — PowerShell as Administrator:",
          "       Start-Service postgresql-x64-14",
          "  2. Or start the server manually:",
          "       & 'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_ctl.exe' start -D 'C:\\Program Files\\PostgreSQL\\14\\data'",
          "",
        ].join("\n")
      );
      process.exit(1);
    }
    throw error;
  }
  if (!services.db.DailyQuest) {
    throw new Error("DbService not properly initialized (DailyQuest model missing)");
  }
  console.log("Bootstrap: game services ready");

  // Game REST API (`/api/*`) is served by the game process; everything else
  // goes to Next.js (UI, static assets, HMR in dev).
  const restHandler = createRestRouter(services);
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/api" || path.startsWith("/api/")) {
      void restHandler(req, res);
      return;
    }
    handle(req, res);
  });

  const gameGateway = new GameGateway();
  gameGateway.attachToServer(server, services, upgradeHandler);

  const worldTickState = createWorldTickState();
  setInterval(
    () =>
      runWorldTick(
        {
          sectorService: services.sectorService,
          presence: services.presence,
          broadcast: services.broadcast,
          player: services.player,
          db: services.db,
          quest: services.quest,
        },
        worldTickState
      ),
    TICK_INTERVAL_MS
  );

  let lastFinalizedWeekStart: string | null = null;
  setInterval(() => {
    const now = new Date();
    const moscow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const isMonday = moscow.getUTCDay() === 1;
    const hour = moscow.getUTCHours();
    if (isMonday && hour === 0) {
      const weekStart = services.tournament.getWeekStartUTC();
      const key = weekStart.toISOString();
      if (lastFinalizedWeekStart !== key) {
        lastFinalizedWeekStart = key;
        void services.tournament.finalizeWeek();
      }
    }
  }, 60 * 60 * 1000);

  const shutdown = (signal: string) => {
    console.log(`Bootstrap: ${signal} received, shutting down...`);
    services.db.close()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  server.listen(port, () => {
    console.log(`Server ready on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
