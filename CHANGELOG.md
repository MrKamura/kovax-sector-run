# Changelog

All notable changes to **Kovax: Sector Run** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [SemVer](https://semver.org/):

- **MAJOR** вЂ” breaking changes (API, WS protocol, save schema)
- **MINOR** вЂ” new features, backward-compatible
- **PATCH** вЂ” bug fixes, docs, small tweaks

When shipping a release: bump `package.json` `version`, add a section here, update `docs/` if behavior/architecture changed.

---
---

## [Unreleased]

### Added

- **Full migration infrastructure**: migration system with React/Native coexistence
- `src/main-native.ts` - native JS entry point for full migration
- `src/config.ts` - configuration for React vs Native mode selection
- `src/migration.ts` - migration factory and tracker for gradual migration
- `docs/MIGRATION.md` - comprehensive migration guide
- Fixed `PlayerPanel` component (recreated with UTF-8 encoding)
- Enhanced nativeX components: `QuestPanel`, `ChatPanel`, `NicknameScreen`, `ShipSelectScreen`, `AuthScreen`
- Native store API: `createNativeStore`, `subscribeToStore`, `getStoreState`, `setStoreState`, `useStoreSelector`
- Native hooks API: `createIntroStoryMachine`, `createSplashMachine`, `createTutorialMachine`
- Enhanced `nativeX.config.ts` with migration controls (`enableMigration`, `forceNative`)
- `isMigrationEnabled()` and `isForceNative()` helper functions
- Updated nativeX exports in `index.ts` for easy imports

### Changed

- **Postponed React migration**: Components can be gradually migrated alongside React
- NativeX components now support `EventEmitter` for inter-component communication
- Added migration status tracking to monitor progress
- Enhanced `Component` base class with `init()`, `render()`, `destroy()` lifecycle
- Updated `nativeStore.ts` exports for better TypeScript support
- Improved migration documentation with usage examples

### Fixed

- Encoding issues in PlayerPanel component (now using UTF-8 compatible code)
- Missing exports in nativeX index.ts
- Native store type definitions for better TypeScript support
- Component lifecycle management (attach/detach event listeners)

### Planned

- Complete migration of all UI components from React to native JS
- Phaser game UI integration with native components
- Performance optimization for native components
- Automated testing for native components

---

## [0.5.0] — 2026-08-10

## [0.5.0] вЂ” 2026-08-10

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

## [0.6.0] вЂ” 2026-11-07

Nest.js removed from the game server. Services are plain classes wired once in `server/container.ts`.

### Added

- Docs completed for current stack: `docs/server.md` (boot order, WS flow, balance), `docs/frontend.md` (`src/lib/`, sockets), `docs/database.md` (migrations 001вЂ“016 + checklist)
- `server/container.ts` вЂ” `GameServices` / `createGameServices()` replaces Nest DI
- Graceful shutdown: SIGINT/SIGTERM в†’ `DbService.close()`
- ESLint ignores `server/dist/**`

### Changed

- Game server: **Nest.js removed** вЂ” services are plain classes; `MessageHandlerService` takes all deps (incl. `TournamentService`) via constructor; `GameGateway.attachToServer(server, services, upgradeHandler)`
- `server/nest/` в†’ `server/game/` (Nest modules gone); world tick is `runWorldTick()` (no `WorldTickService` class)
- Dockerfile cleanup removes `server/game` + `server/container.ts`
- `server/bootstrap.ts`: `ECONNREFUSED` prints short Postgres fix steps instead of a raw Sequelize stack

### Removed

- `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`
- `server/nest/app.module.ts`, `server/nest/game/game.module.ts`
- `experimentalDecorators` / `emitDecoratorMetadata` from `server/tsconfig.json`

---

## [0.6.1] вЂ” 2026-11-08

REST API moved into the game process. One Sequelize / `DbService` for HTTP and WebSocket; Next serves UI only.

### Added

- `server/rest/` вЂ” game REST layer: plain router (`router.ts`), JSON/cookie helpers (`http.ts`), PBKDF2 + session (`auth.ts`), `playerRepo.ts`, 15 handlers in `routes/`
- `server/game/shared/` вЂ” pure game logic shared by client and server: `skills.ts`, `mutation.ts`, `gameDefaults.ts`, `recipes.ts`

### Changed

- **REST out of Next.js**: `bootstrap.ts` intercepts `/api/*` before Next (same URLs; client unchanged); handlers use the game `DbService` вЂ” no second Sequelize / model init
- Client imports shared logic from `server/game/shared/` (same relative pattern as `server/game/models`)
- Dockerfile cleanup also removes `server/rest`
- Docs / `AGENTS.md` updated for the new REST + shared paths

### Removed

- `src/app/api/**` (16 Next route handlers, including unused `/api/presence`)
- `src/lib/db.ts`, `modelInit.ts`, `auth.ts`, `playerRepo.ts`, `skills.ts`, `mutation.ts`, `gameDefaults.ts`, `recipes.ts`, `schemas/`
- Client-side `sequelize.sync()` / `DB_SYNC` вЂ” schema only via migrations (`yarn migrate`)

---

## [0.6.2] вЂ” 2026-11-08

Next.js removed. The client is a Vite + React SPA hosted by the game process.

### Added

- `vite.config.mts`, `index.html`, `src/main.tsx` вЂ” Vite SPA entry
- `server/static.ts` вЂ” production static serving of `client-dist/` (SPA fallback, immutable hashed assets, path-traversal guard)
- ESLint: `typescript-eslint` + `eslint-plugin-react-hooks` (+ node globals for plain `*.js` scripts) replaces `eslint-config-next`

### Changed

- **Next.js removed**: dev вЂ” Vite middleware inside the game server (same port, HMR via `vite-hmr` WebSocket); prod вЂ” `server/static.ts` serves `client-dist/`
- Client restructure: `src/app/page.tsx` в†’ `src/App.tsx`; `src/app/components/*` в†’ `src/components/`; `src/app/hooks/` в†’ `src/hooks/`; `src/app/{constants,types,page.module.css,globals.css}` в†’ `src/`; `src/app/favicon.ico` в†’ `public/favicon.ico`
- Scripts: `build` = `vite build && tsc -p server/tsconfig.json` (plus `build:client`); `build:all` removed
- Dockerfile: `yarn run build`; cleanup drops `vite.config.mts`/`index.html`; `@next/swc` + `@img/sharp` pruning removed; container user renamed to `appuser`
- Lint fixes in game services: `Number(x) ?? fallback` в†’ `Number.isFinite(...)` guards, typed `whereClause` objects, `StatRow` in tournament service

### Fixed

- Dockerfile cleanup now removes `vite.config.mts` (was wrongly `vite.config.ts`)

### Removed

- `next`, `eslint-config-next`, `concurrently`
- `src/app/layout.tsx` (Next root layout + unused `next/font` Geist fonts), `next.config.ts`, `next-env.d.ts`
- `public/{file,globe,vercel,window}.svg` (unreferenced boilerplate)

---

## [Unreleased]

### Fixed

- PlayerPanel nativeX component (temporarily disabled due to encoding issues)

### Added

- NativeX UI library: base `Component` class, `Button`, `Input`, `Card`, `AuthScreen`
- `src/native/` core modules: `ScreenManager`, `EventEmitter`
- `nativeX.config.ts` for global configuration
- Example `src/native/main.ts` with login/register flow
- Documentation in `src/components/nativeX/README.md`

### Changed

- Partial migration from React to native JS started
- React components in `src/components/` remain alongside nativeX versions
- `nativeX/` prefix for CSS classes (configurable via `cssPrefix`)

### Planned

- More UI components: `PlayerPanel`, `QuestPanel`, `ChatPanel`
- Phaser game UI integration
- Full migration path documentation

### Known / infra notes

- React and nativeX components can coexist during migration
- `nativeX` prefix configurable in `nativeX.config.ts`
- Event system uses `EventEmitter` class for component communication

