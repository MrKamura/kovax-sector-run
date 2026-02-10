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
require("reflect-metadata");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: ".env.local" });
dotenv.config();
const http_1 = __importDefault(require("http"));
const next_1 = __importDefault(require("next"));
const core_1 = require("@nestjs/core");
const app_module_1 = require("./nest/app.module");
const game_gateway_1 = require("./nest/game/game.gateway");
const world_tick_service_1 = require("./nest/game/world-tick.service");
const sector_service_1 = require("./nest/game/sector.service");
const presence_service_1 = require("./nest/game/presence.service");
const broadcast_service_1 = require("./nest/game/broadcast.service");
const chat_service_1 = require("./nest/game/chat.service");
const message_handler_service_1 = require("./nest/game/message-handler.service");
const player_service_1 = require("./nest/game/player.service");
const quest_service_1 = require("./nest/game/quest.service");
const tournament_service_1 = require("./nest/game/tournament.service");
const db_service_1 = require("./nest/game/db.service");
const constants_1 = require("./nest/config/constants");
const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";
async function bootstrap() {
    const app = (0, next_1.default)({ dev, port });
    const handle = app.getRequestHandler();
    await app.prepare();
    const upgradeHandler = app.getUpgradeHandler();
    const server = http_1.default.createServer((req, res) => handle(req, res));
    const nestApp = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: false,
    });
    const db = nestApp.get(db_service_1.DbService);
    const sectorService = nestApp.get(sector_service_1.SectorService);
    await sectorService.loadSectorsFromDb(db);
    // Проверяем, что DbService правильно инициализирован
    if (!db.DailyQuest) {
        console.error("Bootstrap: db.DailyQuest is undefined!");
    }
    else {
        console.log("Bootstrap: db.DailyQuest initialized successfully");
    }
    const gameGateway = nestApp.get(game_gateway_1.GameGateway);
    const worldTickState = (0, world_tick_service_1.createWorldTickState)();
    // Получаем все сервисы
    const resolvedDb = nestApp.get(db_service_1.DbService);
    const resolvedPlayer = nestApp.get(player_service_1.PlayerService);
    // Убеждаемся, что DbService полностью инициализирован перед получением QuestService
    if (!resolvedDb.DailyQuest) {
        console.error("Bootstrap: db.DailyQuest is undefined before getting QuestService!");
        throw new Error("DbService not properly initialized");
    }
    // Создаем QuestService вручную с правильными зависимостями
    // Это необходимо, так как createApplicationContext не всегда правильно инжектирует зависимости
    const resolvedQuest = new quest_service_1.QuestService(resolvedDb, resolvedPlayer);
    // Проверяем, что quest имеет db
    if (!resolvedQuest) {
        console.error("Bootstrap: resolvedQuest is undefined!");
    }
    else {
        // Проверяем, что quest имеет доступ к db
        const questDb = resolvedQuest.db;
        if (!questDb) {
            console.error("Bootstrap: resolvedQuest.db is undefined!");
        }
        else if (!questDb.DailyQuest) {
            console.error("Bootstrap: resolvedQuest.db.DailyQuest is undefined!");
        }
        else {
            console.log("Bootstrap: resolvedQuest.db.DailyQuest initialized successfully");
        }
    }
    const resolvedTournament = new tournament_service_1.TournamentService(resolvedDb);
    // Pass resolved services so gateway works when Nest does not inject deps (createApplicationContext)
    gameGateway.attachToServer(server, upgradeHandler, {
        db: resolvedDb,
        presence: nestApp.get(presence_service_1.PresenceService),
        sectorService: nestApp.get(sector_service_1.SectorService),
        broadcast: nestApp.get(broadcast_service_1.BroadcastService),
        chat: nestApp.get(chat_service_1.ChatService),
        messageHandler: nestApp.get(message_handler_service_1.MessageHandlerService),
        player: nestApp.get(player_service_1.PlayerService),
        quest: resolvedQuest,
        tournament: resolvedTournament,
    });
    setInterval(() => {
        (0, world_tick_service_1.runWorldTick)({
            sectorService: nestApp.get(sector_service_1.SectorService),
            presence: nestApp.get(presence_service_1.PresenceService),
            broadcast: nestApp.get(broadcast_service_1.BroadcastService),
            player: nestApp.get(player_service_1.PlayerService),
            db: resolvedDb,
            quest: resolvedQuest,
        }, worldTickState);
    }, constants_1.TICK_INTERVAL_MS);
    let lastFinalizedWeekStart = null;
    setInterval(() => {
        const now = new Date();
        const moscow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        const isMonday = moscow.getUTCDay() === 1;
        const hour = moscow.getUTCHours();
        if (isMonday && hour === 0) {
            const weekStart = resolvedTournament.getWeekStartUTC();
            const key = weekStart.toISOString();
            if (lastFinalizedWeekStart !== key) {
                lastFinalizedWeekStart = key;
                void resolvedTournament.finalizeWeek();
            }
        }
    }, 60 * 60 * 1000);
    server.listen(port, () => {
        console.log(`Server ready on http://localhost:${port}`);
    });
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
