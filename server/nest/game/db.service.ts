import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Sequelize, Op } from "sequelize";
import * as pg from "pg";
import { initModels, UserModel, SessionModel, PlayerModel, ChatMessageModel } from "../models";

export interface ResolvedUser {
  id: number;
  nickname: string | null;
  shipChoice: string | null;
}

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly sequelize: Sequelize;
  readonly User: typeof UserModel;
  readonly Session: typeof SessionModel;
  readonly Player: typeof PlayerModel;
  readonly ChatMessage: typeof ChatMessageModel;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required.");
    }
    this.sequelize = new Sequelize(url, {
      dialect: "postgres",
      dialectModule: pg,
      logging: false,
      define: {
        underscored: false,
      },
    });
    initModels(this.sequelize);
    this.User = UserModel;
    this.Session = SessionModel;
    this.Player = PlayerModel;
    this.ChatMessage = ChatMessageModel;
  }

  async onModuleDestroy(): Promise<void> {
    await this.sequelize.close();
  }

  parseCookies(cookieHeader = ""): Record<string, string> {
    const pairs = cookieHeader.split(";").map((v) => v.trim());
    const out: Record<string, string> = {};
    for (const pair of pairs) {
      if (!pair) continue;
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      out[key] = decodeURIComponent(val);
    }
    return out;
  }

  async resolveUser(sessionToken: string | undefined): Promise<ResolvedUser | null> {
    if (!sessionToken) return null;
    try {
      const session = await this.Session.findOne({
        where: {
          token: sessionToken,
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gt]: new Date() } },
          ],
        },
        attributes: ["userId"],
      });
      if (!session) return null;
      const user = await this.User.findByPk(session.userId, {
        attributes: ["id", "nickname", "shipChoice"],
      });
      if (!user) return null;
      return {
        id: user.id,
        nickname: user.nickname ?? null,
        shipChoice: user.shipChoice ?? null,
      };
    } catch (err) {
      console.error("Auth error:", err);
      return null;
    }
  }
}
