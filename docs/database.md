# Database

## Connection

- `DATABASE_URL` (or `DB_*`) in `.env.local` / `.env`
- Sequelize: `src/lib/db.ts`
- Model init: `src/lib/modelInit.ts` → `server/game/models/*`
- Prefer `DB_SYNC=false` in prod; schema via migrations

## Models (`server/game/models/`)

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

### All migrations (001–016)

| File | What it does |
|------|--------------|
| `001_add_player_levels.sql` | players: level, exp, expToNext, damage, skills |
| `002_add_user_audio_settings.sql` | users: musicVolume, sfxVolume |
| `003_add_chat_messages.sql` | chat_messages table (scope/sector/user/nickname/text/created_at) |
| `004_add_player_monster_progress.sql` | players.monsterProgress JSONB (per-ship progress) |
| `005_add_sectors.sql` | sectors table + 25 predefined sectors (L1-01…L5-05) |
| `006_add_player_sector.sql` | players.sectorId → sectors |
| `007_add_chat_target_user_id.sql` | chat_messages.target_user_id (private scope) |
| `008_add_user_chat_settings.sql` | users: chat layout (position/size/opacity) |
| `009_add_daily_quests.sql` | daily_quests + quest_type CHECK + partial unique index on active quests |
| `010_reset_user_quests.sql` | **no-op**: only commented-out manual reset SQL (real reset: `yarn reset-quests`) |
| `011_add_quest_types_and_multiple_quests.sql` | daily_quests: quest_type/failed_at, indexes |
| `012_add_user_quest_completions.sql` | user_quest_completions history table |
| `013_add_tournament_tables.sql` | player_tournament_stats, tournament_winners, user_titles |
| `014_add_rating_columns.sql` | tournament rating columns (pve/pvp/social × total/week) |
| `015_add_player_mutations.sql` | players.mutations JSONB |
| `016_add_daily_quests_timestamps.sql` | daily_quests created_at/updated_at |

### New migration checklist

1. Next free number: `NNN_short_name.sql` in `server/migrations/`.
2. Idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ … IF NOT EXISTS …`, `ON CONFLICT DO NOTHING`.
3. Test on a fresh DB **and** an existing one (`yarn migrate` runs everything every time).

