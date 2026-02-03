require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");

const PORT = Number(process.env.PRESENCE_PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required for presence server.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const presence = new Map();
const clients = new Map();

const parseCookies = (cookieHeader = "") => {
  const pairs = cookieHeader.split(";").map((value) => value.trim());
  const out = {};
  for (const pair of pairs) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
};

const broadcastPresence = () => {
  const payload = JSON.stringify({
    type: "presence",
    players: Array.from(presence.values()),
  });
  for (const socket of clients.values()) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
};

const savePlayerPosition = async (entry) => {
  if (!entry) return;
  try {
    await pool.query(
      `UPDATE players
       SET "posX" = $1,
           "posY" = $2,
           "rotation" = $3,
           "lastPositionAt" = NOW()
       WHERE "userId" = $4`,
      [entry.x, entry.y, entry.rotation, entry.userId]
    );
  } catch (error) {
    console.error("Failed to save player position:", error);
  }
};

const resolveUser = async (token) => {
  if (!token) return null;
  const session = await pool.query(
    `SELECT "userId"
     FROM sessions
     WHERE token = $1
       AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`,
    [token]
  );
  if (session.rowCount === 0) return null;
  const userId = session.rows[0].userId;
  const user = await pool.query(
    `SELECT id, nickname, "shipChoice"
     FROM users
     WHERE id = $1`,
    [userId]
  );
  if (user.rowCount === 0) return null;
  return user.rows[0];
};

const wss = new WebSocketServer({ port: PORT });
console.log(`Presence WS server on ws://localhost:${PORT}`);

wss.on("connection", async (socket, request) => {
  const cookieHeader = request.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  let user;
  try {
    user = await resolveUser(cookies.session);
  } catch (error) {
    console.error("Auth error:", error);
  }
  if (!user) {
    socket.close(1008, "Unauthorized");
    return;
  }

  clients.set(user.id, socket);
  let posX = 0;
  let posY = 0;
  let rotation = 0;
  try {
    const player = await pool.query(
      `SELECT "posX", "posY", "rotation"
       FROM players
       WHERE "userId" = $1`,
      [user.id]
    );
    if (player.rowCount > 0) {
      posX = Number(player.rows[0].posX) || 0;
      posY = Number(player.rows[0].posY) || 0;
      rotation = Number(player.rows[0].rotation) || 0;
    }
  } catch (error) {
    console.error("Failed to load player position:", error);
  }

  const entry = {
    userId: user.id,
    nickname: user.nickname,
    shipChoice: user.shipChoice,
    x: posX,
    y: posY,
    rotation,
    updatedAt: Date.now(),
    lastSavedAt: 0,
  };
  presence.set(user.id, entry);
  broadcastPresence();

  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "update") {
        const next = presence.get(user.id);
        if (!next) return;
        next.x = Number(message.x) || next.x;
        next.y = Number(message.y) || next.y;
        next.rotation = Number(message.rotation) || 0;
        next.updatedAt = Date.now();
        presence.set(user.id, next);
        broadcastPresence();
        const now = Date.now();
        if (now - next.lastSavedAt > 2000) {
          next.lastSavedAt = now;
          void savePlayerPosition(next);
        }
      }
      if (message.type === "disconnect") {
        const last = presence.get(user.id);
        void savePlayerPosition(last);
        socket.close(1000);
      }
    } catch {
      // ignore invalid messages
    }
  });

  socket.on("close", () => {
    const last = presence.get(user.id);
    presence.delete(user.id);
    clients.delete(user.id);
    void savePlayerPosition(last);
    broadcastPresence();
  });
});
