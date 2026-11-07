# Changelog

All notable changes to **Kovax: Sector Run** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [SemVer](https://semver.org/):

- **MAJOR** — breaking changes (API, WS protocol, save schema)
- **MINOR** — new features, backward-compatible
- **PATCH** — bug fixes, docs, small tweaks

When shipping a release: bump `package.json` `version`, add a section here, update `docs/` if behavior/architecture changed.

---

## [0.5.0] — 2026-08-10

Baseline documentation and agent workflow release. Captures gameplay and infra state as of this version.

### Added

- Agent-oriented docs: `AGENTS.md`, `docs/` (architecture, server, frontend, database, conventions)
- Cursor rule `.cursor/rules/project-docs.mdc` (prefer docs before codebase scan)
- `CHANGELOG.md` and SemVer policy
- First-run tutorial: control hints (WASD / arrows, space) and panel hints; WS `tutorial_complete` grants temporary immunity
- Migration `016_add_daily_quests_timestamps.sql` (`created_at` / `updated_at` on `daily_quests`)
- Public `SectorService.getSectorByLevelAndGrade` for spawn logic

### Fixed

- New / level-1 players always spawn in white sector **`L1-01`** (not any loaded L1 grade)
- Level-up celebration: read `previousLevel` before applying `player_update` patch
- Quest modal / progress panel constrained to game viewport
- Splash / credits timing shortened (`SPLASH_VISIBLE_MS`)

### Changed

- Package manager / scripts oriented to **Yarn**
- README rewritten for current product name and stack
- Version set to **0.5.0**

### Known / infra notes

- Single-process boot: Next + Nest game context + `/ws` via `server/bootstrap.ts` (Nest removed in 0.6.0)
- Docker / GHCR deploy path documented in `.github/DEPLOY.md`
- Quest day / tournament week boundaries use Moscow (UTC+3)

---

## [0.6.0] — 2026-11-07

Nest.js removed from the game server. Services are plain classes wired once in `server/container.ts`.

### Added

- Docs completed for current stack: `docs/server.md` (boot order, WS flow, balance), `docs/frontend.md` (`src/lib/`, sockets), `docs/database.md` (migrations 001–016 + checklist)
- `server/container.ts` — `GameServices` / `createGameServices()` replaces Nest DI
- Graceful shutdown: SIGINT/SIGTERM → `DbService.close()`
- ESLint ignores `server/dist/**`

### Changed

- Game server: **Nest.js removed** — services are plain classes; `MessageHandlerService` takes all deps (incl. `TournamentService`) via constructor; `GameGateway.attachToServer(server, services, upgradeHandler)`
- `server/nest/` → `server/game/` (Nest modules gone); world tick is `runWorldTick()` (no `WorldTickService` class)
- Dockerfile cleanup removes `server/game` + `server/container.ts`
- `server/bootstrap.ts`: `ECONNREFUSED` prints short Postgres fix steps instead of a raw Sequelize stack

### Removed

- `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`
- `server/nest/app.module.ts`, `server/nest/game/game.module.ts`
- `experimentalDecorators` / `emitDecoratorMetadata` from `server/tsconfig.json`

---

## [0.6.1] — 2026-11-08

REST API moved into the game process. One Sequelize / `DbService` for HTTP and WebSocket; Next serves UI only.

### Added

- `server/rest/` — game REST layer: plain router (`router.ts`), JSON/cookie helpers (`http.ts`), PBKDF2 + session (`auth.ts`), `playerRepo.ts`, 15 handlers in `routes/`
- `server/game/shared/` — pure game logic shared by client and server: `skills.ts`, `mutation.ts`, `gameDefaults.ts`, `recipes.ts`

### Changed

- **REST out of Next.js**: `bootstrap.ts` intercepts `/api/*` before Next (same URLs; client unchanged); handlers use the game `DbService` — no second Sequelize / model init
- Client imports shared logic from `server/game/shared/` (same relative pattern as `server/game/models`)
- Dockerfile cleanup also removes `server/rest`
- Docs / `AGENTS.md` updated for the new REST + shared paths

### Removed

- `src/app/api/**` (16 Next route handlers, including unused `/api/presence`)
- `src/lib/db.ts`, `modelInit.ts`, `auth.ts`, `playerRepo.ts`, `skills.ts`, `mutation.ts`, `gameDefaults.ts`, `recipes.ts`, `schemas/`
- Client-side `sequelize.sync()` / `DB_SYNC` — schema only via migrations (`yarn migrate`)

---

## [Unreleased]

### Planned

- In-game shop / monetization (not implemented yet)
