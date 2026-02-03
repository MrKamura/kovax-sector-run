# NestJS game server (TypeScript)

This folder contains the game logic refactored into a NestJS application with TypeScript.

## Structure

- **config/constants.ts** – Game constants (durations, counts, sector configs).
- **game/types.ts** – Shared types (PresenceEntry, Sector, GameSocket, etc.).
- **game/utils.ts** – RNG, player/monster stats, exp, sector name generation.
- **game/db.service.ts** – PostgreSQL pool, cookie parsing, `resolveUser`.
- **game/presence.service.ts** – In-memory presence and client socket maps.
- **game/sector.service.ts** – Sectors, world creation, black holes, safe zone, world snapshot.
- **game/broadcast.service.ts** – `broadcastWorld`, `broadcastPresence`, `sendSelfUpdate`, etc.
- **game/chat.service.ts** – Load/persist chat history.
- **game/player.service.ts** – Save position, award exp, spawn immunity countdown.
- **game/world-tick.service.ts** – Game loop: population, black holes, safe zone, enemy movement, vengeance/hunted push.
- **game/message-handler.service.ts** – WebSocket message handlers (all ported from index.js).
- **game/game.gateway.ts** – Attaches WS server to HTTP, handles connect/message/close.
- **game/game.module.ts** – Game module wiring.
- **app.module.ts** – Root module.

## Running

1. Install dependencies (includes NestJS, tsx): `npm install`
2. **Development:** `npm run dev:nest` (runs `tsx server/bootstrap.ts` – Next.js + WS on one server)
3. **Production:** `npm run build:server` then `npm run start:nest` (runs compiled `server/dist/bootstrap.js`)

Default `npm run dev` and `npm run start` still use the original `server/index.js` until you switch.

## Message handlers

`MessageHandlerService` implements all handlers from `server/index.js`:

- `update` – position, rotation, health, firing, ship choice; spawn immunity; save position.
- `player_dead` – mark entry dead and broadcast presence.
- `respawn` / `respawn_vengeance` – respawn with vengeance/hunted state, DB update, sector chat.
- `use_black_hole` – warp to target sector; `movePlayerToSector` / `movePlayerToSectorById`.
- `pickup_collect` – tokens or scrap; token DB update; scrap respawn after delay.
- `skill_immunity`, `skill_healing`, `skill_fury`, `skill_gravity_pit`, `skill_teleport`.
- `enemy_hit` – damage, kill, exp/tokens, `awardPlayerExp`, level-up chat.
- `player_hit` – PvP damage, death, vengeance/hunted, sector_kill_flash, player_shot_result.
- `asteroid_destroy` – remove asteroid and broadcast world.
- `chat_message` – persist and broadcast chat.
- `request_exit` – exit grace, save position, exit_ready, close.
- `disconnect` – close socket.

When using `createApplicationContext`, the gateway passes resolved services into `handle()` so all handlers use working instances.
