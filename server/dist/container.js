"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameServices = createGameServices;
/**
 * Plain service container for the game server (no DI framework).
 * All services are constructed once, in dependency order, in `createGameServices()`
 * and shared by the gateway, the world tick and the message handler.
 */
const db_service_1 = require("./game/game/db.service");
const presence_service_1 = require("./game/game/presence.service");
const sector_service_1 = require("./game/game/sector.service");
const broadcast_service_1 = require("./game/game/broadcast.service");
const chat_service_1 = require("./game/game/chat.service");
const player_service_1 = require("./game/game/player.service");
const quest_service_1 = require("./game/game/quest.service");
const tournament_service_1 = require("./game/game/tournament.service");
const message_handler_service_1 = require("./game/game/message-handler.service");
function createGameServices() {
    const db = new db_service_1.DbService();
    const presence = new presence_service_1.PresenceService();
    const sectorService = new sector_service_1.SectorService(presence, db);
    const broadcast = new broadcast_service_1.BroadcastService(presence, sectorService);
    const chat = new chat_service_1.ChatService(db);
    const player = new player_service_1.PlayerService(db, broadcast);
    const quest = new quest_service_1.QuestService(db, player);
    const tournament = new tournament_service_1.TournamentService(db);
    const messageHandler = new message_handler_service_1.MessageHandlerService(presence, sectorService, broadcast, chat, player, quest, tournament, db);
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
