import { Module } from "@nestjs/common";
import { DbService } from "./db.service";
import { PresenceService } from "./presence.service";
import { SectorService } from "./sector.service";
import { BroadcastService } from "./broadcast.service";
import { ChatService } from "./chat.service";
import { PlayerService } from "./player.service";
import { QuestService } from "./quest.service";
import { WorldTickService } from "./world-tick.service";
import { MessageHandlerService } from "./message-handler.service";
import { GameGateway } from "./game.gateway";

@Module({
  providers: [
    DbService,
    PresenceService,
    SectorService,
    BroadcastService,
    ChatService,
    PlayerService,
    QuestService,
    WorldTickService,
    MessageHandlerService,
    GameGateway,
  ],
  exports: [GameGateway, WorldTickService, DbService, QuestService],
})
export class GameModule {}
