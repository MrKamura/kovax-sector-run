"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
let DbService = class DbService {
    constructor() {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error("DATABASE_URL is required for presence server.");
        }
        this.pool = new pg_1.Pool({ connectionString: url });
    }
    async onModuleDestroy() {
        await this.pool.end();
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
            const session = await this.pool.query(`SELECT "userId" FROM sessions WHERE token = $1 AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`, [sessionToken]);
            if (session.rowCount === 0)
                return null;
            const userId = session.rows[0].userId;
            const user = await this.pool.query(`SELECT id, nickname, "shipChoice" FROM users WHERE id = $1`, [userId]);
            if (user.rowCount === 0)
                return null;
            const row = user.rows[0];
            return {
                id: row.id,
                nickname: row.nickname ?? null,
                shipChoice: row.shipChoice ?? null,
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
