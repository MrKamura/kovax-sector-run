# Frontend

## Orchestration

`src/app/page.tsx`:

1. Auth (`AuthScreen`)
2. Nickname
3. Splash → Intro story → Ship select (if needed)
4. Game: `SpaceArena` + HUD (quests, chat, player panel, menu, overlays)

Styles: `src/app/page.module.css`. UI constants: `src/app/constants.ts`.

## State

`src/store/gameStore.ts` — Zustand + Immer:

- `user`, `player`, auth/session
- skills / mutations / cooldowns
- death, vengeance, hunted
- quests / tournament UI state
- `applyPlayerUpdate` — level-up celebration via `previousLevel` **before** merging the patch

REST calls go to `/api/*` (served by the game process, `server/rest/`).

## Phaser

| File | Role |
|------|------|
| `src/components/SpaceArena.tsx` | Mounts Phaser.Game; pause on menu/tutorial |
| `src/components/PhaserArena.tsx` | Scene, input, shooting, sync |
| `PhaserArena/socketSchemas.ts` | Zod for inbound messages |
| `PhaserArena/socketHandlers.ts` | Presence/world helpers |
| `PhaserArena/remotePlayers.ts` | Other players |
| `PhaserArena/constants.ts` | Client spawn-immunity sentinel |

Global WS for UI buttons: `getGlobalSocket` / `setGlobalSocket` in `QuestButton.tsx`.

## UI components (`src/app/components/`)

PlayerPanel, QuestPanel, QuestButton, ChatPanel, SettingsMenu, TournamentButton, MutationButton, Death/LevelUp/Exit/QuestComplete overlays, TutorialOverlay, Splash, IntroStory, Nickname/ShipSelect screens.

Hooks: `src/app/hooks/` — `useChat`, `useSplash`, `useIntroStory`, `useTutorial`, skill hotkeys, cooldown.

## Tutorial

localStorage:

- `kovax_tutorial_controls_seen`
- `kovax_tutorial_panels_seen` (JSON array of panel ids)

After all hints: WS `tutorial_complete` + UI “newbie shield”.

## REST API (served by the game process)

`/api/*` is handled by `server/rest/` (intercepted before Next in `bootstrap.ts`); the client just fetches relative URLs. Endpoints: `auth/*` (login, register, logout, me, change-password), `player` (GET), `collect`, `consume-energy`, `craft`, `damage-player`, `mutation` (GET/POST), `skills` (POST/PUT), `upgrade-shelter`, `user/nickname|ship|settings`. Details: [server.md](./server.md#rest-api-serverrest).

## lib (`src/lib/`)

| File | Role |
|------|------|
| `gameBranding.ts` | Game/studio names (title, intro) |

Shared game logic (skills, mutations, defaults, recipes) lives in **`server/game/shared/`** and is imported by the client via relative paths (`../../server/game/shared/...`) — single source of truth for client and server.

## Socket details

- `ReconnectingWebSocket` (`socketHandlers.ts`): 800–5000 ms backoff (×1.2), 10 s connection timeout, unlimited retries
- Clock sync: `serverTime` in `world` / `presence` payloads → smoothed client offset (lerp 0.1)
- Client → server `update` is throttled; server persists position at most every 2 s
- Zod: `socketMessageSchema` (inbound) + `outgoingMessageSchema` (outbound) in `socketSchemas.ts`; chat, tournament and `tutorial_complete` payloads are parsed raw outside the union
- UI buttons (quests, tournament) reuse the arena socket via `getGlobalSocket` / `setGlobalSocket` in `QuestButton.tsx`

