# Level 1 vs Level 1 Mob – Balance Analysis

## Current numbers (from code)

### Player (level 1)
| Stat | Base | keeper19 | keeper20 |
|------|------|----------|----------|
| Max HP | 100 | 85 | 120 |
| Damage per shot | 12 | 10 | 14 |
| Fire repeat | 160 ms (when holding) | → ~6.25 shots/sec | |
| **Effective DPS** | — | ~62.5 | ~87.5 |

### Mob (level 1)
| Stat | Value |
|------|--------|
| Max HP | 110 |
| Damage per hit | 5 |
| Hit interval (when overlapping player) | 150 ms → ~6.67 hits/sec |
| **Effective DPS to player** | 5 × (1000/150) ≈ **33.3** |

### Derived combat metrics

**Player kills mob**
- keeper19: 110 HP ÷ 10 dmg = **11 shots** → ~1.76 s (at 160 ms/shot).
- keeper20: 110 HP ÷ 14 dmg ≈ **8 shots** → ~1.28 s.

**Mob kills player** (if player stays in contact)
- keeper19: 85 HP ÷ 5 dmg = **17 hits** → 17 × 150 ms ≈ **2.55 s**.
- keeper20: 120 HP ÷ 5 dmg = **24 hits** → 24 × 150 ms ≈ **3.6 s**.

So at level 1 vs level 1:
- **To kill the mob:** player needs **8–11 shots** (depending on ship).
- **To die to one mob:** player must stay in contact for **~2.5–3.6 s** (enough time to react and move).

---

## What “comfortable” usually means

1. **Player should win 1v1** if they fight (kite + shoot). So: **player TTK on mob &lt; mob TTK on player** when the player is actively shooting and not face-tanking.
2. **Mob should not feel like a sponge** – killing one mob in **~5–12 shots** (about **0.8–2 s**) is a good band: not instant, not tedious.
3. **Mob should not delete the player instantly** – **15+ hits** to kill the player (≈ **2.25+ s** in contact) gives time to notice low HP, heal, or run.
4. **One mob alone should be manageable** – player can win by kiting; **2–3 mobs** at once can feel dangerous.

So for level 1 vs level 1 we want something like:
- **Shots to kill mob:** about **6–10** (comfortable, not spongy).
- **Hits for mob to kill player:** about **18–30** (enough time to react).

---

## Target formulas (level 1 only)

Use **average** level 1 player damage for a single “reference” player:

- `playerDamage ≈ 12` (base) or ~10–14 with ship mods.
- `playerHP ≈ 100` (base) or 85–120 with ship mods.

**Comfortable mob HP (level 1):**
- Shots to kill = mobHP / playerDamage.
- Target: **6–10 shots** → `mobHP ≈ (6 to 10) × playerDamage`.
- With playerDamage ≈ 12 → **mob HP ≈ 72–120**.  
  So **~80–100** is a safe, comfortable band for level 1 mobs.

**Comfortable mob damage (level 1):**
- Hits to kill player = playerHP / mobDamage.
- Target: **18–28 hits** → `mobDamage ≈ playerHP / (18 to 28)`.
- With playerHP ≈ 100 → **mobDamage ≈ 3.5–5.5**.  
  So **4–5** damage per hit keeps one mob threatening but not instant-kill.

**Current vs suggested (level 1):**
| | Current | Suggested (comfortable) |
|--|--------|---------------------------|
| Mob HP | 110 | **85–100** (e.g. 90) |
| Mob damage | 5 | **4–5** (e.g. 4) |

With **mob HP = 90**, **mob damage = 4**:
- Player (12 dmg) kills mob in **90/12 ≈ 8 shots** (~1.3 s) ✓
- Mob kills player (100 HP) in **100/4 = 25 hits** (~3.75 s in contact) ✓

So:
- **Mob HP:** from 110 down to **~90** → **~7–9 shots** to kill (still tanky, not spongy).
- **Mob damage:** from 5 down to **4** → **~25 hits** to kill player (more room to react).

---

## Summary: characteristics to kill a level 1 mob (comfortable)

- **Mob HP:** about **85–100** (so **~7–9 shots** for a level 1 player with 12 dmg).
- **Mob damage:** about **4–5** per hit (so **~20–25 hits** to kill a 100 HP player).
- **Player:** 160 ms between shots, 150 ms between mob hits when overlapping.

No code changes in this doc; use these ranges to tune `ENEMY_HEALTH`, `BASE_ENEMY_DAMAGE`, and the per-level terms in `enemyStatsForLevel` in `server/nest/config/constants.ts` and `server/nest/game/utils.ts` if you want to match this “comfortable” band.
