# Database

## Connection

- `DATABASE_URL` (or `DB_*`) in `.env.local` / `.env`
- Sequelize: `src/lib/db.ts`
- Model init: `src/lib/modelInit.ts` → `server/nest/models/*`
- Prefer `DB_SYNC=false` in prod; schema via migrations

## Models (`server/nest/models/`)

| Model | Table | Notes |
|-------|-------|-------|
| User | users | nick, ship, audio |
| Session | sessions | cookie session |
| Player | players | resources, position, `sectorId`, mutations JSON |
| Sector | sectors | 25 fixed |
| DailyQuest | daily_quests | **underscored: true** → `created_at` / `updated_at` |
| UserQuestCompletion | … | history |
| ChatMessage | chat_messages | |
| PlayerTournamentStats / TournamentWinner / UserTitle | tournaments | |

`Player` / `User` often use `underscored: false` with explicit `field:` — do not mix styles blindly.

## Migrations

- Directory: `server/migrations/*.sql` (001…016+)
- Run: `yarn run migrate` or `node server/run-migrations.js`
- Docker entrypoint runs migrations on start
- **Runner does not keep an applied table** — every file runs every time → SQL must be idempotent (`IF NOT EXISTS`, `ON CONFLICT`, `DO $$ …`)

### Important migrations

| File | Purpose |
|------|---------|
| `005_add_sectors.sql` | 25 sectors L1–L5 |
| `006_add_player_sector.sql` | player sectorId |
| `009` / `011` | daily_quests + types |
| `013`–`014` | tournaments / ratings |
| `015` | mutations |
| `016_add_daily_quests_timestamps.sql` | `created_at` / `updated_at` for Sequelize timestamps |

Error `column created_at does not exist` on `daily_quests` → apply `016`.
