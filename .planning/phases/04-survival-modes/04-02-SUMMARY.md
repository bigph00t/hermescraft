---
phase: 04-survival-modes
plan: "02"
subsystem: body-modes
tags: [body-tick, survival, combat, autonomous, reactive]
dependency_graph:
  requires: [04-01]
  provides: [MODE-01, MODE-02, MODE-03, MODE-04, MODE-05]
  affects: [start.js, mind/index.js]
tech_stack:
  added: []
  patterns:
    - 300ms setInterval body tick with priority cascade
    - _tickBusy guard for overlapping async tick prevention
    - Position-delta stuck detection (10-tick threshold)
    - Callback getter pattern for mind/body boundary
key_files:
  created:
    - body/modes.js
  modified:
    - mind/index.js
    - start.js
decisions:
  - "isSkillRunning exported as a getter function from mind/index.js — passed as callback from start.js to avoid body/ importing mind/"
  - "checkSurvival fires even during active skills; starvation override (food <= 2) eats unconditionally; hazard flee calls requestInterrupt() cooperatively"
  - "checkCombat uses attackTarget (single hit per tick, non-blocking) not combatLoop — prevents tick from being blocked for full combat duration"
  - "checkItemPickup uses entity.name === 'item' (NOT entity.type per Pitfall 3)"
  - "checkIdleLook gated on !bot.pathfinder.isMoving() (Pitfall 6) to avoid yaw conflict with pathfinder"
metrics:
  duration: "2m 6s"
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 04 Plan 02: Survival Modes Summary

**One-liner:** 300ms autonomous body tick (body/modes.js) with 5-priority cascade — eat+hazard flee, combat, unstuck, item pickup, idle look — wired via isSkillRunning getter from mind/index.js.

## What Was Built

### body/modes.js (new)
A single-export module (`initModes(bot, getSkillRunning)`) that starts a 300ms `setInterval` body tick. Each tick runs a priority-ordered behavior cascade:

1. **Priority 1 — checkSurvival** (always fires, even during active skills)
   - Auto-eat: starvation override (food <= 2) fires even if skill running; normal hunger (food < 14) gated on !getSkillRunning()
   - Hazard flee: checks FIRE_BLOCKS at feet/body positions + oxygenLevel <= 3 for drowning; calls requestInterrupt() cooperatively before fleeing

2. **Priority 2 — checkCombat** (gated on !getSkillRunning())
   - Finds nearest hostile within 8 blocks using HOSTILE_MOBS Set
   - Calls `attackTarget` (single hit/tick, non-blocking) — NOT combatLoop

3. **Priority 3 — checkStuck** (gated on !getSkillRunning())
   - Tracks position delta every tick; triggers after 10 consecutive ticks (3s) of isMoving() with delta < 0.5 blocks
   - Calls `bot.pathfinder.setGoal(null)` to halt

4. **Priority 4 — checkItemPickup** (gated on !getSkillRunning() && !isMoving())
   - Scans bot.entities for `entity.name === 'item'` within 8 blocks
   - Navigates to closest item with 3s timeout

5. **Priority 5 — checkIdleLook** (gated on !getSkillRunning() && !isMoving())
   - Finds nearest entity within 16 blocks and looks at it
   - Rate-limited to once per 3s

The `_tickBusy` flag prevents overlapping async ticks. The body tick catches all errors internally to prevent crashes from propagating to the event loop.

### mind/index.js (modified)
Added exported `isSkillRunning()` getter function that reads the module-level `skillRunning` variable. This exposes the running state to start.js without requiring body/ to import mind/.

### start.js (modified)
- Added `import { initModes } from './body/modes.js'`
- Updated mind import to also include `isSkillRunning`
- Added `initModes(bot, isSkillRunning)` call after `initMind(bot)` completes
- Startup sequence: `createBot()` → `initMind(bot)` → `initModes(bot, isSkillRunning)`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Callback getter for skillRunning | Keeps body/ fully independent of mind/ — start.js owns the bridge |
| attackTarget not combatLoop in tick | combatLoop is blocking (sustained loop); body tick must stay non-blocking (Pitfall 2) |
| entity.name === 'item' | entity.type for dropped items is 'other' not 'item' — mineflayer Pitfall 3 |
| checkIdleLook gated on !isMoving() | lookAt() conflicts with pathfinder yaw control during navigation — Pitfall 6 |
| 10-tick (3s) stuck threshold | pathfinder legitimately pauses at corners/jumps; false positives below 3s — Pitfall 1 |
| Cooperative interrupt before hazard flee | Calls requestInterrupt() first to cleanly cancel active skill before navigating to safety |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 24aa445 | feat(04-02): create body/modes.js — 300ms autonomous body tick |
| bdf957f | feat(04-02): export isSkillRunning getter and wire initModes in start.js |

## Self-Check

Files created/modified:
- body/modes.js: FOUND
- mind/index.js: MODIFIED (isSkillRunning added)
- start.js: MODIFIED (initModes wired)

Commits:
- 24aa445: feat(04-02): create body/modes.js
- bdf957f: feat(04-02): export isSkillRunning getter and wire initModes in start.js

## Self-Check: PASSED
