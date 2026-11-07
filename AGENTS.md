# AGENTS.md — context for AI

Before exploring code, open **`docs/`**. Do not walk the whole repo if these files are enough.

| Doc | When to read |
|-----|----------------|
| [docs/architecture.md](docs/architecture.md) | Start of any task, boot, deploy |
| [docs/server.md](docs/server.md) | WS, game services, balance |
| [docs/frontend.md](docs/frontend.md) | UI, Zustand, Phaser |
| [docs/database.md](docs/database.md) | Sequelize, migrations |
| [docs/conventions.md](docs/conventions.md) | Before commits / risky changes |

## Hard project rules

- **Yarn**, not npm.
- Game and `/ws` live in **one process** (`server/bootstrap.ts`). Do not run “Next only” for gameplay.
- New level-1 players → sector **`L1-01`** (white).
- Migrations are idempotent; the runner does **not** track applied history.
- Do not commit secrets (`.env.local`).
- After code changes: update **`docs/`** and append to **`CHANGELOG.md`** (`[Unreleased]`). On release: bump `package.json` version + dated changelog section. See [docs/conventions.md](docs/conventions.md).

## Where to edit most often

| Area | Paths |
|------|-------|
| WS handlers | `server/game/game/message-handler.service.ts` |
| Connect / spawn | `server/game/game/game.gateway.ts` |
| Balance / tick | `server/game/config/constants.ts`, `world-tick.service.ts` |
| Client socket | `src/components/PhaserArena.tsx`, `PhaserArena/socketSchemas.ts` |
| UI state | `src/store/gameStore.ts` |
| REST API | `server/rest/` (served by the game process before Next) |
| Screen orchestration | `src/app/page.tsx` |
