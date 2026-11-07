# Architecture

## Layers

```
Browser (Next UI + Phaser)
    │  REST /api/*  (cookie session)
    │  WS /ws       (same-origin cookie)
    ▼
server/bootstrap.ts
    ├── Next.js request handler
    ├── Game services (plain classes, server/container.ts)
    └── GameGateway → MessageHandler + tick loop
            ▼
        PostgreSQL (Sequelize)
```

One Node process: HTTP (Next) + upgrade `/ws` → game WebSocket.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/` | App Router, Zustand, Phaser, `lib` for API |
| `server/game/` | Game services + models; wiring in `server/container.ts` |
| `server/migrations/` | SQL 001…N, sorted by filename |
| `server/bootstrap.ts` | Entry (dev: `tsx`) |
| `server/bootstrap-loader.js` | Prod loader → `dist/bootstrap.js` |
| `public/` | Assets (ships, mobs, SFX) |
| `docker/` | Postgres init |
| `.github/` | CI Docker + DEPLOY.md |
| `docs/` | This documentation |

## Boot (dev)

1. `yarn run dev` → `tsx server/bootstrap.ts`
2. dotenv: `.env.local`, then `.env`
3. Next prepare + HTTP server
4. `createGameServices()` — all game services built once, in dependency order (`server/container.ts`)
5. `SectorService.loadSectorsFromDb`
6. `GameGateway.attachToServer` — `/ws` to game, else Next upgrade
7. World tick every `TICK_INTERVAL_MS` (100 ms); SIGINT/SIGTERM → `DbService.close()`
8. Listen `PORT` (local often 3000; Docker 4000)

## Boot (prod Docker)

- Entrypoint: `docker-entrypoint.sh` → migrate → `node server/bootstrap-loader.js`
- Compose: Postgres 16 + app; prod: `docker-compose.prod.yml`, image `ghcr.io/mrkamura/kovax-game-app:latest`
- Details: `.github/DEPLOY.md`

## Auth / session

1. Register/login → PBKDF2 (`src/lib/auth.ts`) → `sessions` table → httpOnly cookie **`session`**
2. Client: `loadSession()` → `/api/auth/me`; cache `localStorage` key `kovax_user_cache`
3. WS: cookie on upgrade → `DbService.resolveUser`
4. Gate: nickname → ship → in-game

Next API and the game server share Sequelize via `src/lib/db.ts` + `src/lib/modelInit.ts` (models from `server/game/models`).

## Key constants

| File | Contents |
|------|----------|
| `server/game/config/constants.ts` | World, enemies, black holes, safe zone, death penalty, tick, spawn immunity |
| `src/app/constants.ts` | Intro, tutorial, splash |
| `src/components/PhaserArena/constants.ts` | Client spawn-immunity sentinel |
| `src/lib/skills.ts`, `mutation.ts`, `gameDefaults.ts`, `gameBranding.ts` | Skills, mutations, branding |

## Time

Quests and tournaments use **Moscow (UTC+3)** day/week boundaries.
