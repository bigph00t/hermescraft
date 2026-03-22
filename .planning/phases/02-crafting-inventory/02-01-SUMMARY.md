---
phase: 02-crafting-inventory
plan: 01
subsystem: crafting
tags: [minecraft-data, mineflayer, crafting, bfs, prismarine-recipe]

# Dependency graph
requires:
  - phase: 01-bot-foundation-core-skills
    provides: body/normalizer.js (normalizeItemName), body/navigate.js (navigateToBlock), body/place.js (placeBlock + FACE), body/interrupt.js (isInterrupted)
provides:
  - body/crafter.js — BFS crafting chain solver (solveCraft) using minecraft-data 1.21.1
  - body/skills/craft.js — craft skill that resolves full dependency chains via solveCraft then executes via bot.recipesFor() + bot.craft()
affects: [03-build-place, mind-layer, agent-skill-dispatch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BFS crafting chain solver: solveCraft(item, inventory) returns { steps, missing } in leaf-to-root order"
    - "Two-recipe-system bridge: BFS solver uses mcData.recipes for dependency resolution; execution uses bot.recipesFor() to get prismarine-recipe objects for bot.craft()"
    - "findOrPlaceCraftingTable: 32-block radius search, falls back to placing from inventory at 4 cardinal ground offsets"
    - "Cooperative interrupt: isInterrupted(bot) checked before loop entry, after every await inside findOrPlaceCraftingTable, and after each bot.craft() call"

key-files:
  created:
    - body/crafter.js
    - body/skills/craft.js
  modified: []

key-decisions:
  - "body/crafter.js is a utility module (not a skill) — skills import solveCraft from it, it is not dispatched directly"
  - "Module-level const mcData init in body/crafter.js — no initCrafter() wrapper needed in body/ pattern"
  - "bot.recipesFor() bridges BFS solver steps to prismarine-recipe objects — raw mcData recipe objects are never passed to bot.craft()"
  - "findOrPlaceCraftingTable auto-crafts a crafting_table from oak_planks if the bot has 4+ planks and no table is available"

patterns-established:
  - "Pattern: utility module in body/ (not body/skills/) — exports pure functions, no bot lifecycle"
  - "Pattern: skill returns { success, reason, item } struct — consistent with gather.js and mine.js"

requirements-completed: [SKILL-03]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 02 Plan 01: Crafting Chain Solver + Craft Skill Summary

**BFS crafting chain solver (minecraft-data 1.21.1) ported to body/crafter.js; craft skill in body/skills/craft.js executes full dependency chains via bot.recipesFor() + bot.craft() with crafting table management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T17:56:38Z
- **Completed:** 2026-03-22T18:00:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Ported v1 agent/crafter.js BFS solver to body/crafter.js with module-level init (no initCrafter wrapper) — verified solveCraft('wooden_pickaxe', {}) returns 3-step chain with oak_log in missing
- Created body/skills/craft.js with full dependency chain resolution, crafting table find/place logic, and cooperative interrupt checks after every await
- Established the two-recipe-system bridge pattern: BFS solver (minecraft-data shapes) for dependency analysis, bot.recipesFor() for prismarine-recipe objects, bot.craft() for execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Port BFS crafting chain solver to body/crafter.js** - `0249327` (feat)
2. **Task 2: Create craft skill that executes BFS-solved chain via bot.craft()** - `76dee2d` (feat)

## Files Created/Modified

- `body/crafter.js` — BFS recipe dependency solver; exports `solveCraft(targetItem, inventory)` returning `{ steps, missing }`
- `body/skills/craft.js` — Craft skill; exports `craft(bot, itemName, count)` that chains solveCraft -> bot.recipesFor -> bot.craft with crafting table management

## Decisions Made

- `body/crafter.js` is a utility module (body/ root, not body/skills/) so it can be imported by multiple skills without lifecycle coupling
- Module-level `const mcData = minecraftData('1.21.1')` replaces the v1 `initCrafter()` pattern — consistent with all other body/ modules
- `bot.recipesFor()` is the mandatory bridge: raw minecraft-data recipe objects must never be passed to `bot.craft()` (would silently fail or error — verified in research)
- `findOrPlaceCraftingTable` attempts 4 cardinal ground offsets for table placement rather than a fixed single position — more robust in varied terrain

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SKILL-03 complete: craft skill resolves full dependency chains from raw materials
- Phase 02 Plan 02 (smelt, chest, inventory skills) can proceed — all body/ primitives and the crafter utility are in place
- No blockers

---
*Phase: 02-crafting-inventory*
*Completed: 2026-03-22*
