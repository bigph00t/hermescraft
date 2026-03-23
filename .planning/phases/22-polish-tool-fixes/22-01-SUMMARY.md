---
phase: 22-polish-tool-fixes
plan: 01
subsystem: body-skills
tags: [mineflayer, tools, gather, mine, chat-loop]

# Dependency graph
requires: []
provides:
  - body/tools.js with shared canHarvestWith utility (named export)
  - gather.js equips with requireHarvest:true and skips unharvestabl blocks via continue
  - mine.js refactored to import canHarvestWith from shared tools.js
  - _consecutiveChatCount resets on any non-chat non-idle dispatch
affects: [body/skills/gather.js, body/skills/mine.js, mind/index.js]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared tool utilities live in body/tools.js and are imported by body/skills/*"
    - "gather skips unharvestabl blocks (continue), mine hard-stops (return early) — different severity for different contexts"

key-files:
  created:
    - body/tools.js
  modified:
    - body/skills/gather.js
    - body/skills/mine.js
    - mind/index.js

key-decisions:
  - "canHarvestWith extracted to body/tools.js as shared utility — DRY across gather and mine"
  - "gather.js uses continue on harvest failure (skip block), mine.js uses early return (hard stop) — matches their differing semantics"
  - "_consecutiveChatCount resets on any non-chat non-idle dispatch, not just successful ones — failed skill attempts still break the chat chain"

patterns-established:
  - "Shared tool utilities: body/tools.js is the home for reusable tool-checking helpers"
  - "equipForBlock with requireHarvest:true is the standard pattern for harvest-aware equip"

requirements-completed: [POLISH-EQUIP, POLISH-CHATCOUNT]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 22 Plan 01: Polish Tool Fixes Summary

**Shared canHarvestWith utility extracted to body/tools.js; gather.js now skips unharvestabl blocks with requireHarvest:true; chat counter resets on any non-chat non-idle dispatch including failures.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-23T08:00:00Z
- **Completed:** 2026-03-23T08:03:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- Created `body/tools.js` with `canHarvestWith` as a shared utility, removing code duplication between gather and mine
- Fixed `gather.js` to call `equipForBlock` with `requireHarvest: true` and skip blocks the agent cannot harvest (continue, not hard-stop)
- Removed inline `canHarvestWith` from `mine.js` — now imports from shared `body/tools.js`
- Fixed `_consecutiveChatCount` reset condition in `mind/index.js` — removes false chat-loop warnings during failure loops

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract canHarvestWith to body/tools.js and fix gather.js equip** - `a3fe1c8` (feat)
2. **Task 2: Fix _consecutiveChatCount reset condition in mind/index.js** - `dc7baa2` (fix)

## Files Created/Modified
- `body/tools.js` - New shared utility module exporting `canHarvestWith`
- `body/skills/gather.js` - Fixed tool equip with requireHarvest:true, added harvest check with continue
- `body/skills/mine.js` - Removed inline canHarvestWith, now imports from body/tools.js
- `mind/index.js` - Removed `&& skillResult.success` from chat count reset condition

## Decisions Made
- `canHarvestWith` extracted to `body/tools.js` — single source of truth, both skills import from there
- `gather` uses `continue` on harvest failure (skip to next candidate) vs `mine` uses early `return` (hard-stop) — this matches their documented semantics: gather is lenient (many wood/dirt blocks need no tool), mine is strict (wrong tier pickaxe wastes drops)
- Chat counter reset: removing `skillResult.success` means agents in failure loops (e.g., gather fails for an unreachable chest) don't accumulate false "consecutive chat" counts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan's verification script for Task 2 checked `src.includes('skillResult.success')` across the whole file, but `skillResult.success` appears in 5 other legitimate places in mind/index.js (broadcast, failure tracking, build logic). The fix was correct per the actual acceptance criteria — the condition on line 572 no longer contains `skillResult.success`. All acceptance criteria verified manually.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tool equipping is now correct — agents will equip appropriately before gathering and skip blocks they can't harvest instead of silently mining with bare fists
- Chat loop detection is more accurate — failure loops won't trigger false consecutive-chat warnings
- Ready for Phase 22 Plan 02

---
*Phase: 22-polish-tool-fixes*
*Completed: 2026-03-23*
