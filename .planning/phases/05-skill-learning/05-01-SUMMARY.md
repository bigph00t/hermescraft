---
phase: 05-skill-learning
plan: 01
subsystem: memory
tags: [death-avoidance, danger-zones, experiential-learning, proximity-warning]

requires:
  - phase: 03-deep-memory
    provides: autobiographical event recording, location persistence, planner memory consolidation
provides:
  - recordDeathLocation function for saving death sites as danger zones
  - getNearbyDangers function for proximity-based danger zone lookup
  - Death-to-danger-zone wiring in agent loop
  - Danger zone warnings injected into planner strategy context
affects: [planner, memory, agent-loop]

tech-stack:
  added: []
  patterns: [danger-zone-entries-in-locations-json, proximity-warning-injection]

key-files:
  created: []
  modified:
    - agent/locations.js
    - agent/index.js
    - agent/planner.js

key-decisions:
  - "Danger zones stored as regular location entries with type='danger' and extra cause/lesson fields -- no new data structure needed"
  - "Cap at 10 danger zones with oldest-eviction to prevent unbounded growth"
  - "30-block radius for proximity warnings balances awareness vs noise"

patterns-established:
  - "Danger entries use danger-N naming convention with incrementing N for uniqueness"
  - "Proximity warning injection follows consolidateMemory section pattern with == HEADER == format"

requirements-completed: [SKILL-03]

duration: 1min
completed: 2026-03-21
---

# Phase 05 Plan 01: Death Avoidance Learning Summary

**Death location danger zones with 30-block proximity warnings injected into planner strategy context**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-21T06:50:16Z
- **Completed:** 2026-03-21T06:51:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Agent now records every death location as a persistent danger zone in locations.json with cause and lesson
- Planner loop checks proximity to danger zones every 60s tick and injects specific warnings into strategy context
- Danger zones capped at 10 entries with oldest-eviction to prevent unbounded growth

## Task Commits

Each task was committed atomically:

1. **Task 1: Add death location tracking and proximity check to locations.js** - `5cf0efa` (feat)
2. **Task 2: Wire death location recording in index.js and danger warnings in planner.js** - `f910bcf` (feat)

## Files Created/Modified
- `agent/locations.js` - Added recordDeathLocation (saves danger-N entries) and getNearbyDangers (3D Euclidean proximity check)
- `agent/index.js` - Added recordDeathLocation import and call in death recording block after autobiographical event
- `agent/planner.js` - Added getNearbyDangers import and DANGER ZONES NEARBY section in consolidateMemory

## Decisions Made
- Danger zones stored as regular location entries with type='danger' and extra cause/lesson fields -- reuses existing locations object, no new data structure
- Cap at 10 danger zones with oldest-eviction (sorted by saved timestamp) to prevent unbounded growth
- 30-block radius for proximity warnings balances awareness vs noise -- close enough to be relevant, far enough to warn early

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Death avoidance learning active -- agent will learn from deaths and avoid dangerous areas
- Ready for 05-02 (skill sharing or additional learning features)
- Danger zone data persists in locations.json alongside other location entries

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits verified in git log (5cf0efa, f910bcf)
- SUMMARY.md created at expected path

---
*Phase: 05-skill-learning*
*Completed: 2026-03-21*
