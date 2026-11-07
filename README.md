# Kovax: Sector Run

Browser online RPG (keepers, sectors, PvP/PvE). Stack: **Next.js**, **Phaser**, **Sequelize + PostgreSQL**, **Zustand**. Game services — plain TypeScript classes (`server/container.ts`, no DI framework). Package manager: **Yarn**.

**Version:** `0.5.0` — see [CHANGELOG.md](./CHANGELOG.md).

## Documentation (humans & AI)

- **[AGENTS.md](./AGENTS.md)** — agent entry point  
- **[docs/](./docs/)** — architecture, server, frontend, DB, conventions  
- **[CHANGELOG.md](./CHANGELOG.md)** — version history  
- **[.github/DEPLOY.md](./.github/DEPLOY.md)** — production deploy  

## Quick start

1. Copy `.env.example` → `.env.local`, set `DATABASE_URL`.
2. Start Postgres.
3. `yarn install && yarn run migrate && yarn run dev`
4. Open [http://localhost:3000](http://localhost:3000) (Docker usually port 4000).

Gameplay and WebSocket `/ws` go through `server/bootstrap.ts` — do not run bare Next for the game.
