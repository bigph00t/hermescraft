---
phase: 05-tool-primitives
plan: 02
subsystem: mod
tags: [java, fabric, minecraft, smart_place, chest, sustained_action, timeout]

# Dependency graph
requires: []
provides:
  - smart_place instant action with full 36-slot inventory equip and placed block data in response
  - chest_deposit sustained action: navigate, open, transfer, close with response details
  - chest_withdraw sustained action: navigate, open, transfer, close with response details
  - sustained action timeout self-clear via sa.future.isDone() check in tickSustainedAction
affects: [06-crafting-intelligence, 07-building-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - chestStep state machine (0=wait for open, 1=transfer) in SustainedAction
    - Self-clear pattern for sustained actions: isDone() check before tick dispatch
    - smart_place combines equip+look+place into one atomic instant action

key-files:
  created: []
  modified:
    - mod/src/main/java/hermescraft/ActionExecutor.java

key-decisions:
  - "smart_place is an instant action, not sustained — equip+look+place all happen in one tick"
  - "Chest actions require x,y,z coordinates and distance check (max 6 blocks) before open"
  - "buildChestContentsJson returns compact string format (item x5, item2 x10) not JSON array"

patterns-established:
  - "SustainedAction fields for new action types are added directly to the SustainedAction class"
  - "Chest step 0 = wait for GenericContainerScreenHandler; step 1 = perform transfer and complete"

requirements-completed: [TOOL-01, TOOL-04, CHEST-01, CHEST-02]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 05 Plan 02: Mod Rebuild — Smart Place + Chest Actions + Timeout Fix Summary

**Java mod ActionExecutor.java extended with smart_place (full 36-slot equip + surface placement + placed data), chest_deposit/chest_withdraw sustained actions, and timeout self-clear fix — mod builds successfully**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T04:02:44Z
- **Completed:** 2026-03-22T04:07:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `smart_place` instant action: searches all 36 inventory slots (not just hotbar 0-8), auto-equips to hotbar, supports both crosshair mode and coordinate+face mode, returns `{"placed": {"block", "x", "y", "z"}}` in response
- Added `chest_deposit` and `chest_withdraw` sustained actions: distance check, open chest via interactBlock, wait for GenericContainerScreenHandler (chestStep 0), shift-click transfer items (chestStep 1), close screen, return transferred item count and chest contents summary
- Fixed sustained action timeout leak: `tickSustainedAction` now checks `sa.future.isDone()` at the very top and self-clears if the HTTP caller already timed out — prevents permanent lock where `currentSustained != null` blocks all future actions
- Mod builds successfully: `BUILD SUCCESSFUL in 9s`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add timeout self-clear + smart_place + chest actions to ActionExecutor.java** - `2e6f51d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `mod/src/main/java/hermescraft/ActionExecutor.java` - Added GenericContainerScreenHandler import, chest fields in SustainedAction, timeout self-clear in tickSustainedAction, smart_place case in executeInstant, chest_deposit/chest_withdraw in processTick and tickSustainedAction, handleSmartPlace method, startChestAction method, tickChestAction method, buildChestContentsJson helper

## Decisions Made

- `smart_place` is an instant action (not sustained): equip + look + interactBlock all happen in a single tick, consistent with how the mod works
- Chest actions require explicit x,y,z coordinates and enforce a 6-block distance limit before attempting to open
- `buildChestContentsJson` returns a compact string format ("item1 x5, item2 x10") rather than a JSON array, to keep the response payload small and readable for the LLM

## Deviations from Plan

None — plan executed exactly as written. The mod jar name is `hermesbridge-1.0.0.jar` (not `hermescraft-*.jar` as noted in the plan), which is expected. No local mods directory exists because the Minecraft clients run on a remote Glass server — the built jar in `mod/build/libs/` is the deliverable.

## Issues Encountered

None.

## User Setup Required

The built jar at `mod/build/libs/hermesbridge-1.0.0.jar` needs to be deployed to the Glass server's Minecraft mods directories to take effect. This requires a Minecraft client restart.

## Next Phase Readiness

- This was the single mod rebuild for Phase 5 — all mod changes are complete
- Agent-side changes (tools.js updates, mine removal) are handled in Plan 05-01 (or 05-03)
- Phase 6 (Crafting Intelligence) and Phase 7 (Building Intelligence) can proceed without further mod rebuilds

## Self-Check: PASSED

- FOUND: mod/src/main/java/hermescraft/ActionExecutor.java
- FOUND: .planning/phases/05-tool-primitives/05-02-SUMMARY.md
- FOUND: commit 2e6f51d

---
*Phase: 05-tool-primitives*
*Completed: 2026-03-22*
