# Server (Nest game)

Code: `server/nest/`. Module: `GameModule` ← `AppModule`.

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

**Important:** in bootstrap, `QuestService` / `TournamentService` are often constructed manually and passed into the gateway as `resolved` — do not rely on Nest DI alone under `createApplicationContext`.

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
