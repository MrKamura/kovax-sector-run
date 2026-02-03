"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModule = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("./db.service");
const presence_service_1 = require("./presence.service");
const sector_service_1 = require("./sector.service");
const broadcast_service_1 = require("./broadcast.service");
const chat_service_1 = require("./chat.service");
const player_service_1 = require("./player.service");
const world_tick_service_1 = require("./world-tick.service");
const message_handler_service_1 = require("./message-handler.service");
const game_gateway_1 = require("./game.gateway");
let GameModule = class GameModule {
};
exports.GameModule = GameModule;
exports.GameModule = GameModule = __decorate([
    (0, common_1.Module)({
        providers: [
            db_service_1.DbService,
            presence_service_1.PresenceService,
            sector_service_1.SectorService,
            broadcast_service_1.BroadcastService,
            chat_service_1.ChatService,
            player_service_1.PlayerService,
            world_tick_service_1.WorldTickService,
            message_handler_service_1.MessageHandlerService,
            game_gateway_1.GameGateway,
        ],
        exports: [game_gateway_1.GameGateway, world_tick_service_1.WorldTickService],
    })
], GameModule);
