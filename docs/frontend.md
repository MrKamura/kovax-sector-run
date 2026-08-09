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

REST wrappers call `src/app/api/**`.

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

## REST API (`src/app/api/`)

`auth/*`, `player`, `collect`, `consume-energy`, `craft`, `damage-player`, `mutation`, `skills`, `upgrade-shelter`, `presence`, `user/nickname|ship|settings`.

Zod schemas: `src/lib/schemas/` where present.
