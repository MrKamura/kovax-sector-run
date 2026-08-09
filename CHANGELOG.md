# Changelog

All notable changes to **Kovax: Sector Run** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [SemVer](https://semver.org/):

- **MAJOR** — breaking changes (API, WS protocol, save schema)
- **MINOR** — new features, backward-compatible
- **PATCH** — bug fixes, docs, small tweaks

When shipping a release: bump `package.json` `version`, add a section here, update `docs/` if behavior/architecture changed.

---

## [0.5.0] — 2026-08-10

Baseline documentation and agent workflow release. Captures gameplay and infra state as of this version.

### Added

- Agent-oriented docs: `AGENTS.md`, `docs/` (architecture, server, frontend, database, conventions)
- Cursor rule `.cursor/rules/project-docs.mdc` (prefer docs before codebase scan)
- `CHANGELOG.md` and SemVer policy
- First-run tutorial: control hints (WASD / arrows, space) and panel hints; WS `tutorial_complete` grants temporary immunity
- Migration `016_add_daily_quests_timestamps.sql` (`created_at` / `updated_at` on `daily_quests`)
- Public `SectorService.getSectorByLevelAndGrade` for spawn logic

### Fixed

- New / level-1 players always spawn in white sector **`L1-01`** (not any loaded L1 grade)
- Level-up celebration: read `previousLevel` before applying `player_update` patch
- Quest modal / progress panel constrained to game viewport
- Splash / credits timing shortened (`SPLASH_VISIBLE_MS`)

### Changed

- Package manager / scripts oriented to **Yarn**
- README rewritten for current product name and stack
- Version set to **0.5.0**

### Known / infra notes

- Single-process boot: Next + Nest game context + `/ws` via `server/bootstrap.ts`
- Docker / GHCR deploy path documented in `.github/DEPLOY.md`
- Quest day / tournament week boundaries use Moscow (UTC+3)

---

## [Unreleased]

### Planned

- In-game shop / monetization (not implemented yet)
