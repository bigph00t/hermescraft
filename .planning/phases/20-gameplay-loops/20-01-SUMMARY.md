---
phase: 20-gameplay-loops
plan: 01
subsystem: gameplay
tags: [mineflayer, skills, harvest, hunt, explore, rag, registry, memorydb]

# Dependency graph
requires:
  - phase: 17-memory-foundation
    provides: logEvent, memoryDB for discovery logging
  - phase: 19-enhanced-spatial-building
    provides: existing registry patterns and EVT_MAP structure
provides:
  - harvest skill: mature crop detection (getProperties().age lambda), harvest, replant
  - hunt skill: 48b radius proactive mob seeking with combatLoop integration
  - explore skill: cardinal direction navigation + notable block/entity discovery scan
  - registry !harvest, !hunt, !explore commands (24 -> 27 commands)
  - deriveRagQuery routing for harvest/hunt/explore/breed/farm
  - explore discoveries individually logged to memoryDB per discovery
affects: [mind/registry, mind/index, body/skills, gameplay-loops-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Crop state check via getProperties().age lambda in bot.findBlocks (required for block-state properties)"
    - "Hunt radius 48b vs reactive combat 16b — proactive seeking pattern"
    - "explore discoveries logged individually to SQLite event log for spatial memory"

key-files:
  created:
    - body/skills/harvest.js
    - body/skills/hunt.js
    - body/skills/explore.js
  modified:
    - mind/registry.js
    - mind/index.js
    - tests/smoke.test.js

key-decisions:
  - "CROP_CONFIG object maps crop block names to mature age + seed item — single source of truth for 4 crop types"
  - "hunt.js uses combatLoop (sustained) not attackTarget (single-hit) — proactive hunt blocks until mob dies"
  - "explore.js returns structured discoveries array, not just success/fail — enables per-discovery memoryDB logging"
  - "EVT_MAP extended: harvest->craft, hunt->combat, explore->discovery, breed->observation, farm->craft"

patterns-established:
  - "Body skill: try/catch wrapper returning { success, reason? } — never throw to caller"
  - "Body skill: isInterrupted(bot) check after every await in loops"
  - "Discover logging: explore fires N logEvent calls, one per discovery item"

requirements-completed: [GPL-01, GPL-02, GPL-03, GPL-04, GPL-06]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 20 Plan 01: Gameplay Loops — Harvest, Hunt, Explore Summary

**Three new body skills (harvest/hunt/explore) wired into registry with 27 commands, RAG routing, and per-discovery SQLite event logging**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-23T22:30:00Z
- **Completed:** 2026-03-23T22:38:00Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- harvest.js: detects mature crops via `getProperties().age` lambda, navigates to each, digs, replants with seed from inventory
- hunt.js: scans 48-block radius for hostile mobs, navigates to closest target, delegates to combatLoop for sustained engagement
- explore.js: navigates in cardinal direction by configurable distance, scans for NOTABLE_BLOCKS (20 structure types) + entities, returns structured discoveries array
- Registry extended from 24 to 27 commands with !harvest, !hunt, !explore entries
- deriveRagQuery and deriveFailureQuery updated with skill-specific knowledge queries
- EVT_MAP extended; explore discoveries fire individual logEvent calls for spatial memory

## Task Commits

Each task was committed atomically:

1. **Task 1: Create body skills — harvest.js, hunt.js, explore.js** - `9ca394e` (feat)
2. **Task 2: Wire skills into registry, RAG routing, and event logging** - `eadb17e` (feat)

## Files Created/Modified
- `body/skills/harvest.js` - Mature crop detection (CROP_CONFIG, getProperties lambda), harvest loop, replant
- `body/skills/hunt.js` - 48b radius hostile search, navigate + combatLoop integration
- `body/skills/explore.js` - Cardinal navigation, NOTABLE_BLOCKS scan, entity discovery, structured return
- `mind/registry.js` - Import + REGISTRY entries for harvest/hunt/explore (24->27 commands)
- `mind/index.js` - deriveRagQuery + deriveFailureQuery routing, EVT_MAP extension, explore per-discovery logging
- `tests/smoke.test.js` - Updated command count assertions from 24 to 27

## Decisions Made
- Used `getProperties().age` lambda form in `bot.findBlocks()` for crop state checking — block ID matching alone can't inspect block state age values
- hunt uses `combatLoop` (blocking sustained loop) rather than `attackTarget` (single non-blocking hit) — the !hunt command is meant to fully engage until mob dies
- explore checks `moved > 10` before logging discoveries — prevents false positives when navigation completely fails (Pitfall 4)
- NOTABLE_BLOCKS covers 20 structure-indicating block types rather than just chest/spawner — gives richer discovery coverage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated smoke test command count from 24 to 27**
- **Found during:** Task 2 (registry wiring)
- **Issue:** Two smoke tests asserted `commands.length === 24` — now incorrect with 3 new commands
- **Fix:** Updated both assertions to `=== 27`; also added harvest/hunt/explore/plan to expectedCmds list
- **Files modified:** tests/smoke.test.js
- **Verification:** `npm test` → 477 passed, 0 failed (was 471 passed, 2 failed)
- **Committed in:** eadb17e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 test correctness fix)
**Impact on plan:** Test update required for accuracy — no scope creep.

## Issues Encountered
- None — node -e with `!=` escape fails in shell; used `--input-type=module` heredoc pattern for ESM verification

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three gameplay loop skills live: !harvest, !hunt, !explore now fully wired
- 477/477 smoke tests passing
- Phase 20 Plan 02 can proceed (breed + smelt RAG routing, or additional gameplay enhancements)

---
*Phase: 20-gameplay-loops*
*Completed: 2026-03-23*
