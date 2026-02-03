import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";

export interface ResolvedUser {
  id: number;
  nickname: string | null;
  shipChoice: string | null;
}

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for presence server.");
    }
    this.pool = new Pool({ connectionString: url });
  }

  async onModuleDestroy() {
    await this.pool.end();
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
      const session = await this.pool.query(
        `SELECT "userId" FROM sessions WHERE token = $1 AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`,
        [sessionToken]
      );
      if (session.rowCount === 0) return null;
      const userId = session.rows[0].userId;
      const user = await this.pool.query(
        `SELECT id, nickname, "shipChoice" FROM users WHERE id = $1`,
        [userId]
      );
      if (user.rowCount === 0) return null;
      const row = user.rows[0];
      return {
        id: row.id,
        nickname: row.nickname ?? null,
        shipChoice: row.shipChoice ?? null,
      };
    } catch (err) {
      console.error("Auth error:", err);
      return null;
    }
  }
}
