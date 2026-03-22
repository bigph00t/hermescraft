---
phase: 06-crafting-intelligence
plan: 01
subsystem: crafting
tags: [minecraft-data, recipe-solver, BFS, crafting-chain, normalizer]

# Dependency graph
requires:
  - phase: 05-tool-primitives
    provides: normalizer.js with normalizeItemName() for item name canonicalization
provides:
  - agent/crafter.js with initCrafter() and solveCraft() exports
  - BFS crafting dependency chain resolver using minecraft-data 1.21.1
  - minecraft-data declared as explicit direct dependency in package.json
affects: [07-building-intelligence, planner.js integration, action-queue crafting steps]

# Tech tracking
tech-stack:
  added: [minecraft-data ^3.105.0 (explicit direct dep, was transitive)]
  patterns:
    - BFS/DFS recipe chain solving with simulated inventory tracking
    - Leaf-to-root step ordering (prerequisites before target)
    - Score-based recipe variant selection (prefer inventory-matching ingredients)
    - Quantity math via ceil(needed / recipe_output) craft operations

key-files:
  created:
    - agent/crafter.js
    - agent/tests/crafter.test.js
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use minecraft-data directly at startup — no separate recipes.json file to maintain"
  - "selectBestVariant tie-breaks by preferring end of recipes array (oak variants are last, most common early-game)"
  - "Simulated inventory tracks what crafting will produce to avoid redundant prerequisite steps"
  - "visited Set prevents infinite recursion without throwing on circular recipes"

patterns-established:
  - "initCrafter() called once at agent startup, no per-agent state"
  - "solveCraft returns { steps, missing } — steps are leaf-to-root, missing are raw materials not in inventory"
  - "Each step: { action: 'craft', item, count, ingredients: [{item, count}], needsTable }"

requirements-completed: [CRAFT-01]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 6 Plan 1: Crafting Intelligence — BFS Solver Summary

**minecraft-data 1.21.1 BFS recipe chain solver that resolves full dependency trees from inventory, returning ordered leaf-to-root craft steps with crafting table flags and inventory-aware variant selection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T04:27:28Z
- **Completed:** 2026-03-22T04:29:36Z
- **Tasks:** 2
- **Files modified:** 4 (package.json, package-lock.json, agent/crafter.js, agent/tests/crafter.test.js)

## Accomplishments

- Declared minecraft-data ^3.105.0 as explicit direct dependency (was transitive via mineflayer)
- Created agent/crafter.js with initCrafter() and solveCraft() loading 782 recipe types from minecraft-data
- BFS solver resolves wooden_pickaxe from empty inventory into 3 ordered steps: oak_planks -> stick -> wooden_pickaxe
- Recipe variant selection prefers ingredients already in inventory (e.g. spruce_planks over oak_planks when available)
- 3x3 shaped recipes flagged needsTable=true; 2x2 and shapeless flagged false
- All 12 TDD tests pass; plan's 4 verification checks pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare minecraft-data in package.json** - `997dbef` (chore)
2. **Task 2 RED: Failing tests for crafter.js** - `c3b3c96` (test)
3. **Task 2 GREEN: Implement crafter.js** - `6cd6acb` (feat)

_Note: TDD task has two commits (test RED + feat GREEN). No refactor pass needed — code was clean as written._

## Files Created/Modified

- `agent/crafter.js` — BFS recipe chain solver; exports initCrafter() and solveCraft()
- `agent/tests/crafter.test.js` — 12 TDD tests covering all behavior specs
- `package.json` — minecraft-data added to dependencies
- `package-lock.json` — lockfile updated

## Decisions Made

- Use minecraft-data directly at startup (no separate recipes.json to maintain) — per existing STATE.md decision
- selectBestVariant tie-breaks by preferring end of recipes array (oak variants last = most common early-game)
- Simulated inventory (`simInventory`) tracks what crafting produces, so downstream steps don't re-craft unnecessarily
- visited Set guards against circular recipe references without throwing errors

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npm install minecraft-data` didn't update package.json because npm detected it already satisfied as transitive dep. Used Edit tool to add it explicitly, then re-ran npm install to update lockfile. npm then showed it as a direct dep (`├── minecraft-data@3.105.0`) rather than deduped.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- crafter.js is ready for integration into planner.js (Phase 6 Plan 2)
- solveCraft output format matches the action-queue item structure (type, args, reason)
- The two-call pattern for 3x3 crafting (open table, then craft) must be handled by the queue expansion layer, not crafter.js — crafter just returns the step with needsTable=true
- Plan 06-02 will wire solveCraft into the planner tool so the LLM can trigger dependency-aware crafting chains

---
*Phase: 06-crafting-intelligence*
*Completed: 2026-03-22*

## Self-Check: PASSED

- agent/crafter.js: FOUND
- agent/tests/crafter.test.js: FOUND
- 06-01-SUMMARY.md: FOUND
- Commit 997dbef (chore: declare minecraft-data): FOUND
- Commit c3b3c96 (test: failing tests): FOUND
- Commit 6cd6acb (feat: implement crafter.js): FOUND
