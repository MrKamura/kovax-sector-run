import "reflect-metadata";
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
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./nest/app.module";
import { GameGateway } from "./nest/game/game.gateway";
import { runWorldTick, createWorldTickState } from "./nest/game/world-tick.service";
import { SectorService } from "./nest/game/sector.service";
import { PresenceService } from "./nest/game/presence.service";
import { BroadcastService } from "./nest/game/broadcast.service";
import { ChatService } from "./nest/game/chat.service";
import { MessageHandlerService } from "./nest/game/message-handler.service";
import { PlayerService } from "./nest/game/player.service";
import { QuestService } from "./nest/game/quest.service";
import { TournamentService } from "./nest/game/tournament.service";
import { DbService } from "./nest/game/db.service";
import { TICK_INTERVAL_MS } from "./nest/config/constants";

const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";

async function bootstrap() {
  console.log("Bootstrap: starting Next.js...");
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  console.log("Bootstrap: Next.js ready");

  const upgradeHandler = app.getUpgradeHandler();
  const server = http.createServer((req, res) => handle(req, res));

  console.log("Bootstrap: starting Nest...");
  const nestApp = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const db = nestApp.get(DbService);
  const sectorService = nestApp.get(SectorService);
  await sectorService.loadSectorsFromDb(db);

  // Проверяем, что DbService правильно инициализирован
  if (!db.DailyQuest) {
    console.error("Bootstrap: db.DailyQuest is undefined!");
  } else {
    console.log("Bootstrap: db.DailyQuest initialized successfully");
  }

  const gameGateway = nestApp.get(GameGateway);
  const worldTickState = createWorldTickState();

  // Получаем все сервисы
  const resolvedDb = nestApp.get(DbService);
  const resolvedPlayer = nestApp.get(PlayerService);
  
  // Убеждаемся, что DbService полностью инициализирован перед получением QuestService
  if (!resolvedDb.DailyQuest) {
    console.error("Bootstrap: db.DailyQuest is undefined before getting QuestService!");
    throw new Error("DbService not properly initialized");
  }
  
  // Создаем QuestService вручную с правильными зависимостями
  // Это необходимо, так как createApplicationContext не всегда правильно инжектирует зависимости
  const resolvedQuest = new QuestService(resolvedDb, resolvedPlayer);
  
  // Проверяем, что quest имеет db
  if (!resolvedQuest) {
    console.error("Bootstrap: resolvedQuest is undefined!");
  } else {
    // Проверяем, что quest имеет доступ к db
    const questDb = (resolvedQuest as any).db;
    if (!questDb) {
      console.error("Bootstrap: resolvedQuest.db is undefined!");
    } else if (!questDb.DailyQuest) {
      console.error("Bootstrap: resolvedQuest.db.DailyQuest is undefined!");
    } else {
      console.log("Bootstrap: resolvedQuest.db.DailyQuest initialized successfully");
    }
  }

  const resolvedTournament = new TournamentService(resolvedDb);

  // Pass resolved services so gateway works when Nest does not inject deps (createApplicationContext)
  gameGateway.attachToServer(server, upgradeHandler, {
    db: resolvedDb,
    presence: nestApp.get(PresenceService),
    sectorService: nestApp.get(SectorService),
    broadcast: nestApp.get(BroadcastService),
    chat: nestApp.get(ChatService),
    messageHandler: nestApp.get(MessageHandlerService),
    player: nestApp.get(PlayerService),
    quest: resolvedQuest,
    tournament: resolvedTournament,
  });
  setInterval(() => {
    runWorldTick(
      {
        sectorService: nestApp.get(SectorService),
        presence: nestApp.get(PresenceService),
        broadcast: nestApp.get(BroadcastService),
        player: nestApp.get(PlayerService),
        db: resolvedDb,
        quest: resolvedQuest,
      },
      worldTickState
    );
  }, TICK_INTERVAL_MS);

  let lastFinalizedWeekStart: string | null = null;
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
