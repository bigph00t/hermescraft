---
phase: 04-survival-modes
plan: "01"
subsystem: combat
tags: [mineflayer, minecraft-data, mineflayer-pathfinder, combat, hostile-mobs]

# Dependency graph
requires:
  - phase: 01-bot-foundation-core-skills
    provides: body primitives (navigate.js, interrupt.js), pathfinder plugin loaded
  - phase: 03-mind-loop-llm
    provides: mind/registry.js dispatch bridge for wiring !combat

provides:
  - body/skills/combat.js with attackTarget (single-hit, body tick use) + combatLoop (sustained, LLM dispatch)
  - HOSTILE_MOBS Set (42 entries, minecraft-data 1.21.1) exported for body/modes.js reuse
  - !combat command registered in mind/registry.js

affects:
  - 04-02-PLAN.md (body/modes.js imports HOSTILE_MOBS and attackTarget from combat.js)
  - start.js (combat skill available without additional wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HOSTILE_MOBS Set built from minecraft-data at module load — O(1) lookup, 42 entries for MC 1.21.1
    - attackTarget for body tick (non-blocking single action) vs combatLoop for LLM dispatch (blocking sustained loop)
    - Health-gated retreat using vec3 .minus().normalize().scaled(12).plus() flee direction math
    - GoalFollow with dynamic=true for chasing moving targets

key-files:
  created:
    - body/skills/combat.js
  modified:
    - mind/registry.js

key-decisions:
  - "Two-export combat design: attackTarget (one action per tick, body use) + combatLoop (sustained until dead, LLM dispatch) — separates reactive body behaviors from blocking LLM-dispatched skills"
  - "HOSTILE_MOBS exported from combat.js so body/modes.js (Plan 02) can import without rebuilding the Set"
  - "Registry !combat uses nearestEntity(e.type === 'mob') not HOSTILE_MOBS filter — LLM explicitly chose to attack, so any nearby mob is valid target"
  - "CJS import pattern preserved: import mpf from 'mineflayer-pathfinder' then destructure goals — consistent with 01-02 decision"

patterns-established:
  - "Pattern: split reactive single-action vs sustained loop into two exports for the same combat domain"
  - "Pattern: export shared constants (HOSTILE_MOBS) from skill module so body/modes.js avoids rebuilding at init"

requirements-completed: [SKILL-06, MODE-02]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 04 Plan 01: Combat Skill Summary

**combat.js with attackTarget (body tick single-hit) + combatLoop (LLM-dispatchable sustained loop), HOSTILE_MOBS Set (42 entries), and !combat wired into registry**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T18:49:03Z
- **Completed:** 2026-03-22T18:50:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Combat skill module with two named exports matching plan spec exactly (attackTarget for body tick, combatLoop for LLM dispatch)
- HOSTILE_MOBS Set with 42 entries built from minecraft-data 1.21.1 at module load — exported for Plan 02 (body/modes.js) to reuse
- Health-gated retreat at 3 hearts (6 HP) using vec3 flee vector math in both exports
- !combat command wired into mind/registry.js — listCommands() returns 8 commands including combat

## Task Commits

Each task was committed atomically:

1. **Task 1: Create body/skills/combat.js** - `403058f` (feat)
2. **Task 2: Wire !combat into mind/registry.js** - `651bb41` (feat)

## Files Created/Modified
- `body/skills/combat.js` - Combat skill: attackTarget (single hit, GoalFollow chase, health retreat), combatLoop (sustained loop with interrupt checks), HOSTILE_MOBS Set
- `mind/registry.js` - Added combatLoop import + combat entry to REGISTRY Map

## Decisions Made
- Two-export design separates body tick use (attackTarget, non-blocking) from LLM dispatch use (combatLoop, blocking). Plan 02 needs attackTarget; !combat needs combatLoop.
- HOSTILE_MOBS exported from combat.js so modes.js imports it without rebuilding. Single source of truth.
- Registry !combat finds nearest `e.type === 'mob'` entity (not filtered by HOSTILE_MOBS) because the LLM explicitly chose to attack — any nearby mob is a valid target when the LLM says so.
- Kept CJS import pattern for mineflayer-pathfinder consistent with [01-02] decision in STATE.md.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `body/skills/combat.js` is ready for Plan 02 (body/modes.js) to import `attackTarget` and `HOSTILE_MOBS`
- `mind/registry.js` !combat dispatch fully operational
- No blockers for Plan 02

---
*Phase: 04-survival-modes*
*Completed: 2026-03-22*
