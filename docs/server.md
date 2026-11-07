# Server

Code: `server/` (game logic in `server/game/`). No DI framework — all services are built once in `server/container.ts` (`createGameServices()`) and passed to the gateway / message handler / world tick.

## Services

| Service | File | Role |
|---------|------|------|
| GameGateway | `game/game.gateway.ts` | Attach WS, auth on connect, initial world/self/presence/chat/quests |
| MessageHandlerService | `game/message-handler.service.ts` | All inbound WS |
| PresenceService | `game/presence.service.ts` | In-memory players + sockets |
| SectorService | `game/sector.service.ts` | 25 sectors, world, BH, safe zone |
| BroadcastService | `game/broadcast.service.ts` | Sector broadcasts |
| PlayerService | `game/player.service.ts` | Position, exp, spawn immunity |
| QuestService | `game/quest.service.ts` | Daily mob/PvP |
| ChatService | `game/chat.service.ts` | Chat |
| TournamentService | `game/tournament.service.ts` | Weekly leaderboard |
| DbService | `game/db.service.ts` | Sequelize, cookies, user |
| WorldTick | `game/world-tick.service.ts` | World tick, vengeance, quest reset |

**Important:** no DI framework. All services are constructed once in `server/container.ts` (`createGameServices()`) and shared by the gateway, the world tick and the message handler. New service → build it in the container (dependency order) + add to `GameServices`.

## Sectors

- ID: `L{level}-{01..05}` (migration `005_add_sectors.sql`)
- Suffix = **grade**: 1 white … 5 gold. `L1-01` = white level 1
- PvP off on grade 1
- Capacity ~20
- New / level-1 players: always **`L1-01`** (`getSectorByLevelAndGrade(1, 1)` in gateway)

## Presence

`Map<userId, PresenceEntry>`: position, HP, sectorId, vengeance/hunted, skill state, `hasPvpQuest`. Separate `clients: Map<userId, Set<socket>>`.

## Spawn immunity

- Sentinel `SPAWN_IMMUNITY_UNTIL_FIRST_ACTION = 1e15` until first action
- Then `SPAWN_IMMUNITY_AFTER_ACTION_MS` (5s)
- `tutorial_complete` → temporary shield (`TUTORIAL_BUFF_DURATION_MS`)

## Inbound WS (`message.type`)

`update`, `player_dead`, `respawn`, `respawn_vengeance`, `use_black_hole`, `pickup_collect`, `skill_immunity`, `skill_healing`, `skill_fury`, `skill_gravity_pit`, `skill_teleport`, `enemy_hit`, `player_hit`, `start_quest`, `cancel_quest`, `asteroid_destroy`, `chat_message`, `chat_history_request`, `tournament_leaderboard`, `request_exit`, `disconnect`, `tutorial_complete`

## Outbound (main)

`presence`, `world`, `self`, `player_update`, `chat_history`, `quest_progress`, `teleport_complete`, `exit_ready`, `sector_kill_flash`, `player_shot_result`, `tournament_leaderboard`, death/warp payloads

New message type: add a branch in `MessageHandlerService.handle`, Zod in `src/components/PhaserArena/socketSchemas.ts` if needed, and send from Phaser/UI.

## Quests

Types: `mob_kills` | `pvp_kills`. One active quest of a type per sector/day (Moscow). Table `daily_quests`, model with `underscored: true`.

## Boot order (`server/bootstrap.ts`)

1. dotenv `.env.local` → `.env`; `uncaughtException` / `unhandledRejection` → `process.exit(1)`
2. Next `prepare()` → HTTP server via `getRequestHandler()`
3. `createGameServices()` — all services built once, in dependency order (`server/container.ts`)
4. `SectorService.loadSectorsFromDb` (25 sectors, DB only)
5. `GameGateway.attachToServer(server, services, upgradeHandler)` — container services passed in
6. `setInterval(runWorldTick, 100 ms)`; hourly check → `finalizeWeek()` at Monday 00:00 (Moscow), guarded by `lastFinalizedWeekStart`
7. `server.listen(PORT)` — local 3000, Docker 4000; SIGINT/SIGTERM → `DbService.close()`

**Troubleshooting — `ECONNREFUSED` on boot:** PostgreSQL is not running. The bootstrap prints the fix steps instead of a raw stack trace:
- service (PowerShell as Administrator): `Start-Service postgresql-x64-14`
- or manually: `& 'C:\Program Files\PostgreSQL\14\bin\pg_ctl.exe' start -D 'C:\Program Files\PostgreSQL\14\data'`

## WS connection flow

1. Cookie `session` → `DbService.resolveUser`; missing → `close(1008, "Unauthorized")`
2. Restore position/rotation/health/level from `players` (per-monster `monsterProgress[keeper19|keeper20]`)
3. Sector assignment: live presence → its sector; **level 1 → `L1-01`**; else saved `players.sectorId` (fallback `L1-01` / `findOrCreateSector(1, …)`)
4. Initial payloads in order: `world` → `self` (+ `vengeance` / `hunted` if active) → `chat_history` (sector) → `chat_history` (global) → `quest_progress` (per active quest, or availability)
5. `message` → `MessageHandlerService.handle(user, msg, ws, resolved)`; invalid JSON ignored
6. `close` → remove presence, `savePlayerPosition`, broadcast presence to the sector

## Balance

Source of truth: `server/game/config/constants.ts` + `server/game/game/utils.ts`. Combat analysis: [MOB_BALANCE_ANALYSIS.md](./MOB_BALANCE_ANALYSIS.md).

### World

| Param | Value |
|-------|-------|
| Sector size | 4400×3200 (base 2200×1600 ×2); capacity 20 |
| Population | base consts × area (×4 for current sectors): pickups 48 (base 12), enemies 32 (base 8), asteroids 208 (base 52); enemy respawn 12 s, pickup 7 s |
| Enemies | speed 90, vision 520, roam radius 260 (roam speed ×0.5); HP `90 + (lvl−1)×40`, damage `4 + (lvl−1)` |
| Black holes | ≤6 per sector; appear after 6 s, live 60 s; warp only to adjacent levels; target-grade weights white 1 / green 0.5 / yellow ⅓ / purple 0.25 / gold 0.2 |
| Safe zone | radius 120, 60 s, cooldown 5 min; +4 HP/s inside; 5 s immunity on exit |
| Gravity pits | radius 180, 5 s, ×0.35 slow (owners excluded) |
| Spawn immunity | until first action (sentinel `1e15`), then 5 s; `tutorial_complete` grants 5–15 s shield |

### Progression

- Levels 1–100; `expToNext = 100 + (lvl−1)×60`
- `maxHealth = 100 + (lvl−1)×8`; `damage = 12 + (lvl−1)×2` (runtime `playerStatsForLevel`; legacy DB default from migration 001 was 18 + 2×(lvl−1))
- Monster mods: keeper19 ×0.85, keeper20 ×1.2 (HP and damage)
- Energy cap `10 + floor((lvl−1)/3)`; mob drops `10 + (mobLvl−1)×5` tokens
- Progress stored per monster in `players.monsterProgress`

### Death

- Penalty = random 30–50% + grade add (2/5/8/12/15), capped at 100% — applied to exp **and** tokens
- PvP death: ×1.5 extra
- PvP kill cycle: victim gets **vengeance** (5 min, damage ×1.15, `respawn_vengeance` near the killer); killer marked **hunted** (5 min)

### Quests (daily, per sector, Moscow day)

| Type | Goal | Time limit | Reward |
|------|------|-----------|--------|
| `mob_kills` | 20 kills | 5 min | 250 exp, 75 tokens |
| `pvp_kills` | 3 kills | 10 min | 500 exp, 150 tokens |

One completion per day/sector/type (Moscow UTC+3); cancelled quests are deleted; expiring quests are cleaned by the world tick at date rollover (hour 0); dying to mobs fails an active PvP quest (system chat message).

### Tournament (weekly, Moscow Monday)

- Points: PvE `10 × mobLvl`; PvP `50 + 20 × victimLvl`; quest `100`
- 10 categories (`tournament.constants.ts`); leaderboard top 50 via WS `tournament_leaderboard`
- `finalizeWeek()`: top 3 per category → `tournament_winners` + title `tournament_{cat}_rank_{1..3}` in `user_titles`; weekly columns reset

### Sectors

- 25 = 5 levels (DB `level` column) × 5 grades (ID suffix `-01…-05`; 1 white … 5 gold); config (color, enemy range, PvP, black-hole weight) is keyed by **grade**
- PvP disabled only for grade 1 (white)
- Min player level per sector level: 1 / 25 / 50 / 75 / 100
- Enemy level range per grade: 1–5 / 5–10 / 10–15 / 15–20 / 20–25
- Black-hole spawn weight per grade: 1 / 0.75 / 0.5 / 0.3 / 0.15

