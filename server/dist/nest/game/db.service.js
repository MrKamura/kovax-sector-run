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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("sequelize");
const pg = __importStar(require("pg"));
const models_1 = require("../models");
let DbService = class DbService {
    constructor() {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error("DATABASE_URL is required.");
        }
        this.sequelize = new sequelize_1.Sequelize(url, {
            dialect: "postgres",
            dialectModule: pg,
            logging: false,
            define: {
                underscored: false,
            },
        });
        (0, models_1.initModels)(this.sequelize);
        this.User = models_1.UserModel;
        this.Session = models_1.SessionModel;
        this.Player = models_1.PlayerModel;
        this.ChatMessage = models_1.ChatMessageModel;
        this.Sector = models_1.SectorModel;
        this.DailyQuest = models_1.DailyQuestModel;
        this.UserQuestCompletion = models_1.UserQuestCompletionModel;
    }
    async onModuleDestroy() {
        await this.sequelize.close();
    }
    parseCookies(cookieHeader = "") {
        const pairs = cookieHeader.split(";").map((v) => v.trim());
        const out = {};
        for (const pair of pairs) {
            if (!pair)
                continue;
            const idx = pair.indexOf("=");
            if (idx === -1)
                continue;
            const key = pair.slice(0, idx).trim();
            const val = pair.slice(idx + 1).trim();
            out[key] = decodeURIComponent(val);
        }
        return out;
    }
    async resolveUser(sessionToken) {
        if (!sessionToken)
            return null;
        try {
            const session = await this.Session.findOne({
                where: {
                    token: sessionToken,
                    [sequelize_1.Op.or]: [
                        { expiresAt: null },
                        { expiresAt: { [sequelize_1.Op.gt]: new Date() } },
                    ],
                },
                attributes: ["userId"],
            });
            if (!session)
                return null;
            const user = await this.User.findByPk(session.userId, {
                attributes: ["id", "nickname", "shipChoice"],
            });
            if (!user)
                return null;
            return {
                id: user.id,
                nickname: user.nickname ?? null,
                shipChoice: user.shipChoice ?? null,
            };
        }
        catch (err) {
            console.error("Auth error:", err);
            return null;
        }
    }
};
exports.DbService = DbService;
exports.DbService = DbService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DbService);
