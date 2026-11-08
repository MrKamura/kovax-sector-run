# Architecture

## Layers

```
Browser (React UI + Phaser)
    │  REST /api/*  (cookie session)
    │  WS /ws       (same-origin cookie)
    ▼
server/bootstrap.ts
    ├── Client UI: Vite middleware (dev) / static client-dist (prod)
    ├── Game services (plain classes, server/container.ts)
    └── GameGateway → MessageHandler + tick loop
            ▼
        PostgreSQL (Sequelize)
```

One Node process: HTTP (REST + client UI) + upgrade `/ws` → game WebSocket.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/` | React SPA (Vite), Zustand, Phaser, `lib` |
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
3. Vite dev server (`vite.config.mts`, middleware mode — HMR WS through this server)
4. `createGameServices()` — all game services built once, in dependency order (`server/container.ts`)
5. `SectorService.loadSectorsFromDb`
6. REST router (`server/rest/router.ts`) + HTTP server: `/api/*` → game REST, else client UI
7. `GameGateway.attachToServer` — `/ws` to game, else Vite HMR upgrade
8. World tick every `TICK_INTERVAL_MS` (100 ms); SIGINT/SIGTERM → Vite close + `DbService.close()`
9. Listen `PORT` (local often 3000; Docker 4000)

## Boot (prod Docker)

- Entrypoint: `docker-entrypoint.sh` → migrate → `node server/bootstrap-loader.js`
- Serves: static `client-dist/` (built by `vite build`, SPA fallback, `server/static.ts`) + `/api/*` + `/ws`
- Compose: Postgres 16 + app; prod: `docker-compose.prod.yml`, image `ghcr.io/mrkamura/kovax-game-app:latest`
- Details: `.github/DEPLOY.md`

## Auth / session

1. Register/login → PBKDF2 (`server/rest/auth.ts`) → `sessions` table → httpOnly cookie **`session`**
2. Client: `loadSession()` → `/api/auth/me`; cache `localStorage` key `kovax_user_cache`
3. WS: cookie on upgrade → `DbService.resolveUser`
4. Gate: nickname → ship → in-game

The REST API (`/api/*`) is served by the game process itself (`server/rest/`) — the same `DbService`/models as the game, intercepted before the UI handler in `bootstrap.ts`.

## Key constants

| File | Contents |
|------|----------|
| `server/game/config/constants.ts` | World, enemies, black holes, safe zone, death penalty, tick, spawn immunity |
| `src/constants.ts` | Intro, tutorial, splash |
| `src/components/PhaserArena/constants.ts` | Client spawn-immunity sentinel |
| `server/game/shared/skills.ts`, `mutation.ts`, `gameDefaults.ts`, `recipes.ts` | Skills, mutations, defaults, crafting — shared client/server |
| `src/lib/gameBranding.ts` | Branding |

## Time

Quests and tournaments use **Moscow (UTC+3)** day/week boundaries.
