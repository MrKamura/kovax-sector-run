# Frontend

## Build / dev

- Entry: `index.html` → `src/main.tsx` (React `createRoot`), config: `vite.config.mts`
- **Dev:** the game server hosts Vite as middleware (same port as REST/WS, HMR enabled — the `vite-hmr` WebSocket is upgraded by Vite's listener on the game server)
- **Build:** `yarn build` = `vite build` (→ `client-dist/`) + `tsc -p server/tsconfig.json` (→ `server/dist/`)
- **Prod:** `server/static.ts` serves `client-dist/` (SPA fallback to `index.html`; hashed `/assets/*` immutable, `index.html` no-cache)

## Orchestration

`src/App.tsx`:

1. Auth (`AuthScreen`)
2. Nickname
3. Splash → Intro story → Ship select (if needed)
4. Game: `SpaceArena` + HUD (quests, chat, player panel, menu, overlays)

Styles: `src/page.module.css`. UI constants: `src/constants.ts`.

## State

`src/store/gameStore.ts` — Zustand + Immer:

- `user`, `player`, auth/session
- skills / mutations / cooldowns
- death, vengeance, hunted
- quests / tournament UI state
- `applyPlayerUpdate` — level-up celebration via `previousLevel` **before** merging the patch

`src/store/nativeStore.ts` — Native store (Zustand-compatible API without React hooks):

- `createNativeStore<T>` — create store with initial state
- `subscribeToStore` — subscribe to state changes
- `getStoreState` — get current state
- `setStoreState` — update state
- `useStoreSelector` — extract selector from state

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

## UI components (`src/components/`)

PlayerPanel, QuestPanel, QuestButton, ChatPanel, SettingsMenu, TournamentButton, MutationButton, Death/LevelUp/Exit/QuestComplete overlays, TutorialOverlay, Splash, IntroStory, Nickname/ShipSelect screens.

Hooks: `src/hooks/` — `useChat`, `useSplash`, `useIntroStory`, `useTutorial`, skill hotkeys, cooldown.

## Native UI (`src/components/nativeX/`)

New native JS UI library for gradual migration from React:

| File | Role |
|------|------|
| `Component.ts` | Base class for all components |
| `Button.ts` | Button component |
| `Input.ts` | Input field component |
| `Card.ts` | Card container component |
| `AuthScreen.ts` | Login/register screen |
| `index.ts` | All exports |
| `nativeX.config.ts` | Configuration |
| `examples.ts` | Usage examples |

Core modules (`src/native/`):

| File | Role |
|------|------|
| `ScreenManager.ts` | Screen transitions |
| `EventEmitter.ts` | Event system |
| `main.ts` | App entry example |

Details: [docs/native.md](./native.md).

## Tutorial

localStorage:

- `kovax_tutorial_controls_seen`
- `kovax_tutorial_panels_seen` (JSON array of panel ids)

After all hints: WS `tutorial_complete` + UI “newbie shield”.

## REST API (served by the game process)

`/api/*` is handled by `server/rest/` (intercepted before the UI handler in `bootstrap.ts`); the client just fetches relative URLs. Endpoints: `auth/*` (login, register, logout, me, change-password), `player` (GET), `collect`, `consume-energy`, `craft`, `damage-player`, `mutation` (GET/POST), `skills` (POST/PUT), `upgrade-shelter`, `user/nickname|ship|settings`. Details: [server.md](./server.md#rest-api-serverrest).

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

