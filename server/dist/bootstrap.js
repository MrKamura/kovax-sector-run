"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
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
const http_1 = __importDefault(require("http"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const game_gateway_1 = require("./game/game/game.gateway");
const world_tick_service_1 = require("./game/game/world-tick.service");
const container_1 = require("./container");
const router_1 = require("./rest/router");
const static_1 = require("./static");
const constants_1 = require("./game/config/constants");
const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
function isDbConnectionError(error) {
    const err = error;
    return (err?.name === "SequelizeConnectionRefusedError" ||
        err?.code === "ECONNREFUSED" ||
        err?.parent?.code === "ECONNREFUSED" ||
        (err?.message ?? "").includes("ECONNREFUSED"));
}
async function bootstrap() {
    console.log("Bootstrap: creating game services...");
    let services;
    try {
        services = (0, container_1.createGameServices)();
        await services.sectorService.loadSectorsFromDb(services.db);
    }
    catch (error) {
        if (isDbConnectionError(error)) {
            const dbUrl = (process.env.DATABASE_URL ?? "").replace(/:([^:@/]+)@/, ":***@");
            console.error([
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
            ].join("\n"));
            process.exit(1);
        }
        throw error;
    }
    if (!services.db.DailyQuest) {
        throw new Error("DbService not properly initialized (DailyQuest model missing)");
    }
    console.log("Bootstrap: game services ready");
    const restHandler = (0, router_1.createRestRouter)(services);
    // UI: in dev, Vite runs as middleware inside this server (same port, HMR
    // included); in production, the static client build is served from client-dist/.
    let viteDev = null;
    let staticHandler = null;
    const server = http_1.default.createServer((req, res) => {
        const urlPath = (req.url ?? "/").split("?")[0];
        if (urlPath === "/api" || urlPath.startsWith("/api/")) {
            void restHandler(req, res);
            return;
        }
        if (viteDev) {
            viteDev.middlewares(req, res, (err) => {
                if (err) {
                    console.error("Vite middleware error:", err);
                    if (!res.headersSent)
                        res.writeHead(500);
                    res.end("Internal Server Error");
                }
                else if (!res.headersSent) {
                    res.writeHead(404);
                    res.end("Not Found");
                }
            });
            return;
        }
        staticHandler(req, res, () => {
            res.writeHead(404);
            res.end("Not Found");
        });
    });
    if (isProd) {
        // In production bootstrap runs from server/dist/, so the client build is two levels up.
        const clientDir = path_1.default.resolve(__dirname, "..", "..", "client-dist");
        if (!(0, fs_1.existsSync)(path_1.default.join(clientDir, "index.html"))) {
            console.error(`Bootstrap: client build not found at ${clientDir} — run "yarn build" first.`);
            process.exit(1);
        }
        staticHandler = (0, static_1.createStaticHandler)(clientDir);
        console.log("Bootstrap: serving static client from client-dist/");
    }
    else {
        const viteSpecifier = "vite";
        const { createServer } = (await Promise.resolve(`${viteSpecifier}`).then(s => __importStar(require(s))));
        viteDev = await createServer({
            configFile: path_1.default.resolve(__dirname, "..", "vite.config.mts"),
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
    const gameGateway = new game_gateway_1.GameGateway();
    gameGateway.attachToServer(server, services, (request, socket) => {
        const protocol = request.headers["sec-websocket-protocol"];
        if (!isProd && (protocol === "vite-hmr" || protocol === "vite-ping")) {
            // Handled by Vite's own upgrade listener; leave the socket alone.
            return Promise.resolve();
        }
        socket.destroy();
        return Promise.resolve();
    });
    const worldTickState = (0, world_tick_service_1.createWorldTickState)();
    setInterval(() => (0, world_tick_service_1.runWorldTick)({
        sectorService: services.sectorService,
        presence: services.presence,
        broadcast: services.broadcast,
        player: services.player,
        db: services.db,
        quest: services.quest,
    }, worldTickState), constants_1.TICK_INTERVAL_MS);
    let lastFinalizedWeekStart = null;
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
    const shutdown = (signal) => {
        console.log(`Bootstrap: ${signal} received, shutting down...`);
        void (async () => {
            if (viteDev)
                await viteDev.close().catch(() => { });
            await services.db.close().catch(() => { });
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
