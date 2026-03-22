---
phase: 07-live-testing-bug-fixes
plan: 01
subsystem: core
tags: [mineflayer, minecraft-data, normalizer, prompt, dependencies]

# Dependency graph
requires: []
provides:
  - package.json with mineflayer, minecraft-data, vec3 as explicit direct dependencies
  - normalizer.js correctly differentiates block vs item aliases (iron_ore/gold_ore)
  - mind/prompt.js documents all 11 registry commands including deposit and withdraw
affects: [body, mind, all skills that use normalizeBlockName or normalizeItemName]

# Tech tracking
tech-stack:
  added: [mineflayer ^4.35.0 (explicit), minecraft-data ^3.105.0 (explicit), vec3 ^0.1.10 (explicit)]
  patterns:
    - COMMON_ALIASES vs ITEM_ONLY_ALIASES split in normalizer — block registry never aliases ore names

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - body/normalizer.js
    - mind/prompt.js

key-decisions:
  - "Split normalizer ALIASES into COMMON_ALIASES and ITEM_ONLY_ALIASES — registry identity check (registry === ITEM_REGISTRY) determines which set applies"
  - "iron_ore and gold_ore kept as ITEM_ONLY_ALIASES — they ARE valid block names so must not be remapped during block normalization"

patterns-established:
  - "Normalizer pattern: use registry identity (=== ITEM_REGISTRY vs BLOCK_REGISTRY) to apply type-specific aliases conditionally"

requirements-completed: [FIX-01, FIX-02]

# Metrics
duration: 12min
completed: 2026-03-22
---

# Phase 07 Plan 01: Live Testing Bug Fixes — Deps, Ore Alias, Prompt Commands Summary

**Three silent bugs fixed: explicit npm deps for clean install, iron/gold ore block alias preventing mining, and deposit/withdraw commands missing from LLM system prompt**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-22T20:30:00Z
- **Completed:** 2026-03-22T20:42:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added mineflayer, minecraft-data, and vec3 as explicit direct dependencies in package.json — `npm ci` on a clean machine no longer silently relies on transitive dep resolution
- Fixed ore alias bug in normalizer.js: `normalizeBlockName('iron_ore')` now returns `iron_ore` (correct block name for `!mine`) instead of `raw_iron` (item-only name that breaks block lookups)
- Added `!deposit` and `!withdraw` to the LLM system prompt — LLM now knows all 11 registry commands exist and has concrete usage examples

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix package.json missing direct deps and normalizer ore alias bug** - `18c4ab2` (fix)
2. **Task 2: Add deposit/withdraw commands to LLM system prompt** - `cd0ccae` (fix)

## Files Created/Modified

- `package.json` - Added mineflayer, minecraft-data, vec3 as direct deps (alphabetically sorted)
- `package-lock.json` - Updated by npm install to reflect new explicit deps
- `body/normalizer.js` - Split ALIASES into COMMON_ALIASES + ITEM_ONLY_ALIASES; _normalize checks registry identity before applying item-only aliases
- `mind/prompt.js` - Added !deposit and !withdraw to Part 6 Available commands and Part 7 examples

## Decisions Made

- Used registry identity comparison (`registry === ITEM_REGISTRY`) rather than a boolean flag parameter — this is zero-overhead and keeps the function signature unchanged
- Kept ITEM_ONLY_ALIASES as a separate object (not a Set) so the target mapped name is co-located with the source key for readability

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three silent bugs that would fail on a live server are now fixed
- `npm ci` on a clean machine will install all required packages
- `!mine item:iron_ore` will correctly find iron_ore blocks in the world
- LLM will now issue `!deposit` and `!withdraw` commands when it needs to interact with chests
- Ready for Phase 07 Plan 02 (remaining live-testing fixes)

---
*Phase: 07-live-testing-bug-fixes*
*Completed: 2026-03-22*
