# Kovax: Sector Run — documentation

Browser online RPG (keepers, sectors, PvP/PvE). Stack: **Next.js + Phaser + PostgreSQL/Sequelize**, one HTTP process, WebSocket on `/ws`. Game services — plain TypeScript classes wired in `server/container.ts` (no DI framework).

## For AI agents

Read in this order (saves tokens — avoid full-repo scans):

1. [../AGENTS.md](../AGENTS.md) — short index and rules
2. [architecture.md](./architecture.md) — boot, layers, deploy
3. The layer you need:
   - [server.md](./server.md) — Nest, WS, services
   - [frontend.md](./frontend.md) — UI, store, Phaser
   - [database.md](./database.md) — models, migrations
4. [conventions.md](./conventions.md) — gotchas before editing

Also: [../CHANGELOG.md](../CHANGELOG.md) (versions), [MOB_BALANCE_ANALYSIS.md](./MOB_BALANCE_ANALYSIS.md), [../.github/DEPLOY.md](../.github/DEPLOY.md), [../server/game/README.md](../server/game/README.md).

**Current version:** see `package.json` / [CHANGELOG.md](../CHANGELOG.md). Keep docs + changelog updated whenever code changes.

## Quick commands

```bash
yarn install
yarn run migrate          # SQL from server/migrations
yarn run dev              # tsx server/bootstrap.ts
yarn run build:all
```

Package manager: **Yarn** (`yarn.lock`). Not npm.
