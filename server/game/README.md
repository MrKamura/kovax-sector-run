# Game server (TypeScript)

The game logic as plain TypeScript classes — **no DI framework** (Nest was removed).
Services are wired once in `server/container.ts` (`createGameServices()`), in dependency order.

## Structure

- **config/constants.ts** – Game constants (durations, counts, sector configs).
- **game/types.ts** – Shared types (PresenceEntry, Sector, GameSocket, etc.).
- **game/utils.ts** – RNG, player/monster stats, exp, sector name generation.
- **game/db.service.ts** – Sequelize ORM, cookie parsing, `resolveUser`.
- **game/presence.service.ts** – In-memory presence and client socket maps.
- **game/sector.service.ts** – Sectors, world creation, black holes, safe zone, world snapshot.
- **game/broadcast.service.ts** – `broadcastWorld`, `broadcastPresence`, `sendSelfUpdate`, etc.
- **game/chat.service.ts** – Load/persist chat history.
- **game/player.service.ts** – Save position, award exp, spawn immunity countdown.
- **game/world-tick.service.ts** – Game loop: population, black holes, safe zone, enemy movement, vengeance/hunted push.
- **game/message-handler.service.ts** – WebSocket message handlers.
- **game/game.gateway.ts** – Attaches WS server to HTTP, handles connect/message/close.
- **models/** – Sequelize models (shared with the Next API side via `src/lib/modelInit.ts`).

## Running

1. Install dependencies: `yarn install`
2. **Development:** `yarn dev` (runs `tsx server/bootstrap.ts` – Next.js + WS on one server)
3. **Production:** `yarn build:server` then `node server/bootstrap-loader.js` (runs compiled `server/dist/bootstrap.js`)

`yarn dev` and `yarn start` use the game server (`server/bootstrap.ts` / `server/dist/bootstrap.js`).

## Message handlers

`MessageHandlerService` implements all WebSocket handlers:

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

Dependencies arrive via the constructor (built in `server/container.ts`); the gateway receives the whole `GameServices` object in `attachToServer(server, services, upgradeHandler)`.
