# Conventions & gotchas

## Must

1. **Yarn** (`yarn.lock`, Dockerfile Corepack). Do not add `package-lock.json`.
2. Gameplay only via **bootstrap** (Next + Nest + WS).
3. New level-1 players → sector **`L1-01`**, not `findOrCreateSector(1)` (that picks any grade by load).
4. Commits only when the user explicitly asks.
5. Do not commit `.env` or secrets.
6. **Keep docs and changelog in sync with code** (see Documentation & releases below).

## Documentation & releases

On any meaningful code change, in the same work session:

1. Update the matching file under `docs/` (and `AGENTS.md` if entry points change).
2. Add a bullet under `CHANGELOG.md` → `## [Unreleased]` (Added / Changed / Fixed / Removed).
3. When the user asks for a release: bump `package.json` `version`, move Unreleased notes into a new `## [X.Y.Z] — YYYY-MM-DD` section, clear Unreleased (or leave Planned).

Current version: see `package.json` (`0.5.0` at time of this docs pass).

## Nest / DI

Under `createApplicationContext`, injection may fail. Project pattern: construct services in bootstrap and pass `resolved` into gateway / message handler.

## Sequelize

- `DailyQuest`: `timestamps: true` + `underscored: true` → snake_case columns.
- Do not use `import type` for classes Nest must inject (needs a runtime import).

## Client / level-up

In `applyPlayerUpdate`, read `previousLevel` **before** `Object.assign`, or celebration never fires. Server patch may include `previousLevel`.

## Quest UI

Quest modals: `position: fixed`, stay inside `sceneWrapper` / viewport. `QuestPanel` clamps drag to the game container.

## WS schemas

Zod in `socketSchemas.ts` is not a full list of server types — chat, tournament, `tutorial_complete`, `respawn_vengeance` may live outside the schema. When adding messages, sync both sides.

## Balance / time

- Death penalty depends on sector grade.
- Quests/tournaments — Moscow calendar.
- World tick 100 ms.
