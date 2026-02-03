import "reflect-metadata";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

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
import { DbService } from "./nest/game/db.service";
import { TICK_INTERVAL_MS } from "./nest/config/constants";

const port = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";

async function bootstrap() {
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const upgradeHandler = app.getUpgradeHandler();
  const server = http.createServer((req, res) => handle(req, res));

  const nestApp = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const gameGateway = nestApp.get(GameGateway);
  const worldTickState = createWorldTickState();

  // Pass resolved services so gateway works when Nest does not inject deps (createApplicationContext)
  gameGateway.attachToServer(server, upgradeHandler, {
    db: nestApp.get(DbService),
    presence: nestApp.get(PresenceService),
    sectorService: nestApp.get(SectorService),
    broadcast: nestApp.get(BroadcastService),
    chat: nestApp.get(ChatService),
    messageHandler: nestApp.get(MessageHandlerService),
    player: nestApp.get(PlayerService),
  });
  setInterval(() => {
    runWorldTick(
      {
        sectorService: nestApp.get(SectorService),
        presence: nestApp.get(PresenceService),
        broadcast: nestApp.get(BroadcastService),
        player: nestApp.get(PlayerService),
        db: nestApp.get(DbService),
      },
      worldTickState
    );
  }, TICK_INTERVAL_MS);

  server.listen(port, () => {
    console.log(`Server ready on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
