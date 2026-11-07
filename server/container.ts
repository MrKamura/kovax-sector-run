/**
 * Plain service container for the game server (no DI framework).
 * All services are constructed once, in dependency order, in `createGameServices()`
 * and shared by the gateway, the world tick and the message handler.
 */
import { DbService } from "./game/game/db.service";
import { PresenceService } from "./game/game/presence.service";
import { SectorService } from "./game/game/sector.service";
import { BroadcastService } from "./game/game/broadcast.service";
import { ChatService } from "./game/game/chat.service";
import { PlayerService } from "./game/game/player.service";
import { QuestService } from "./game/game/quest.service";
import { TournamentService } from "./game/game/tournament.service";
import { MessageHandlerService } from "./game/game/message-handler.service";

export interface GameServices {
  db: DbService;
  presence: PresenceService;
  sectorService: SectorService;
  broadcast: BroadcastService;
  chat: ChatService;
  player: PlayerService;
  quest: QuestService;
  tournament: TournamentService;
  messageHandler: MessageHandlerService;
}

export function createGameServices(): GameServices {
  const db = new DbService();
  const presence = new PresenceService();
  const sectorService = new SectorService(presence, db);
  const broadcast = new BroadcastService(presence, sectorService);
  const chat = new ChatService(db);
  const player = new PlayerService(db, broadcast);
  const quest = new QuestService(db, player);
  const tournament = new TournamentService(db);
  const messageHandler = new MessageHandlerService(
    presence,
    sectorService,
    broadcast,
    chat,
    player,
    quest,
    tournament,
    db
  );
  return {
    db,
    presence,
    sectorService,
    broadcast,
    chat,
    player,
    quest,
    tournament,
    messageHandler,
  };
}