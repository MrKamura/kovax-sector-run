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
import { existsSync } from "fs";
import path from "path";
import { GameGateway } from "./game/game/game.gateway";
import { runWorldTick, createWorldTickState } from "./game/game/world-tick.service";
import { createGameServices } from "./container";
import { createRestRouter } from "./rest/router";
import { createStaticHandler } from "./static";
import { TICK_INTERVAL_MS } from "./game/config/constants";

const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";

/** Minimal structural type of the Vite dev server (vite is a devDependency, types resolved at runtime only). */
type ViteDevServer = {
  middlewares: (
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse,
    next: (err?: unknown) => void
  ) => void;
  close: () => Promise<void>;
};

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

  const restHandler = createRestRouter(services);

  // UI: in dev, Vite runs as middleware inside this server (same port, HMR
  // included); in production, the static client build is served from client-dist/.
  let viteDev: ViteDevServer | null = null;
  let staticHandler: ((req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void) | null = null;

  const server = http.createServer((req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0];
    if (urlPath === "/api" || urlPath.startsWith("/api/")) {
      void restHandler(req, res);
      return;
    }
    if (viteDev) {
      viteDev.middlewares(req, res, (err?: unknown) => {
        if (err) {
          console.error("Vite middleware error:", err);
          if (!res.headersSent) res.writeHead(500);
          res.end("Internal Server Error");
        } else if (!res.headersSent) {
          res.writeHead(404);
          res.end("Not Found");
        }
      });
      return;
    }
    staticHandler!(req, res, () => {
      res.writeHead(404);
      res.end("Not Found");
    });
  });

  if (isProd) {
    // In production bootstrap runs from server/dist/, so the client build is two levels up.
    const clientDir = path.resolve(__dirname, "..", "..", "client-dist");
    if (!existsSync(path.join(clientDir, "index.html"))) {
      console.error(`Bootstrap: client build not found at ${clientDir} — run "yarn build" first.`);
      process.exit(1);
    }
    staticHandler = createStaticHandler(clientDir);
    console.log("Bootstrap: serving static client from client-dist/");
  } else {
    const viteSpecifier = "vite";
    const { createServer } = (await import(viteSpecifier)) as {
      createServer: (options?: Record<string, unknown>) => Promise<ViteDevServer>;
    };
    viteDev = await createServer({
      configFile: path.resolve(__dirname, "..", "vite.config.mts"),
      server: {
        middlewareMode: true,
        port,
        // Route HMR websocket upgrades through this server (Vite attaches its
        // own "upgrade" listener for the vite-hmr/vite-ping protocols).
        ws: { server },
      },
    });
    console.log("Bootstrap: Vite dev server ready (HMR enabled)");
  }

  const gameGateway = new GameGateway();
  gameGateway.attachToServer(server, services, (request, socket) => {
    const protocol = request.headers["sec-websocket-protocol"];
    if (!isProd && (protocol === "vite-hmr" || protocol === "vite-ping")) {
      // Handled by Vite's own upgrade listener; leave the socket alone.
      return Promise.resolve();
    }
    socket.destroy();
    return Promise.resolve();
  });

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
    void (async () => {
      if (viteDev) await viteDev.close().catch(() => {});
      await services.db.close().catch(() => {});
      process.exit(0);
    })();
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
