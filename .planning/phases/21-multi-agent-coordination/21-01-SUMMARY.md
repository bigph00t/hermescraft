---
phase: 21-multi-agent-coordination
plan: 01
subsystem: coordination
tags: [multi-agent, shared-state, atomic-write, task-registry, coordination]

# Dependency graph
requires: []
provides:
  - "mind/taskRegistry.js: shared task claim/release registry with atomic writes and optimistic concurrency"
  - "mind/coordination.js: per-agent activity broadcast with 120s TTL stale detection"
  - "mind/buildPlanner.js: claimBuildSection and releaseSection for multi-agent build splitting"
affects:
  - 21-02-multi-agent-coordination
  - mind/index.js
  - start.js

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic shared-file writes: writeFileSync(tmp) + renameSync(tmp, target) for all shared JSON"
    - "Optimistic concurrency: re-read after write to verify claim survived racing writes"
    - "Stale TTL pattern: 10-min claim TTL for task/section recovery after agent crash"
    - "Per-agent activity files: data/shared/activity-<agent>.json with 120s staleness window"

key-files:
  created:
    - mind/taskRegistry.js
    - mind/coordination.js
  modified:
    - mind/buildPlanner.js

key-decisions:
  - "data/shared/ lives as a sibling of data/<agent>/ — computed via dirname(config.dataDir)"
  - "Stale claim TTL is 10 minutes for both task registry and build sections"
  - "Optimistic concurrency check (re-read after write) handles simultaneous claims from two agents"
  - "getPartnerActivityForPrompt returns null for both missing files and age > 120s — same null signal"
  - "claimBuildSection only claims 'pending' sections (not 'active' or 'done') even if stale"

patterns-established:
  - "Shared-file coordination: all inter-agent state lives under data/shared/ as JSON"
  - "Cold-start safety: _loadRegistry returns empty struct on ENOENT; mkdirSync with recursive:true"
  - "Stale-claim cleanup: initTaskRegistry calls _releaseStaleOwn() on every startup"

requirements-completed: [COO-01, COO-03, COO-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 21 Plan 01: Multi-Agent Coordination Data Layer Summary

**Shared task registry (claim/release with optimistic concurrency), per-agent activity broadcasting, and build section claiming — the coordination data layer for two-agent Minecraft play**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-23T22:59:13Z
- **Completed:** 2026-03-23T23:03:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `mind/taskRegistry.js` with 6 exports: full task lifecycle (register, claim, release, complete, list) with atomic renameSync writes, optimistic concurrency re-read, 10-min stale TTL, and startup cleanup of own stale claims
- Created `mind/coordination.js` with 3 exports: per-agent activity broadcast to `data/shared/activity-<agent>.json` and partner activity formatter with 120s stale detection returning null for offline partners
- Extended `mind/buildPlanner.js` with `claimBuildSection` and `releaseSection` using the existing `claimedBy` field on section objects, wired through the existing `saveBuildPlan` atomic write path

## Task Commits

Each task was committed atomically:

1. **Task 1: Create taskRegistry.js and coordination.js** - `e31433c` (feat)
2. **Task 2: Add claimBuildSection and releaseSection to buildPlanner.js** - `f58fe46` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `mind/taskRegistry.js` - Shared task registry: claim/release/list/register/complete with atomic writes, optimistic concurrency, stale TTL
- `mind/coordination.js` - Activity broadcasting: broadcastActivity writes per-agent JSON, getPartnerActivityForPrompt reads partner file with 120s TTL
- `mind/buildPlanner.js` - Added claimBuildSection (first available pending section) and releaseSection (null out claim)

## Decisions Made

- `data/shared/` directory path computed via `dirname(config.dataDir)` — keeps shared state as a sibling of per-agent dirs, no extra config needed
- Stale TTL is 10 minutes for both task claims and build section claims — enough for any normal gameplay pause
- `getPartnerActivityForPrompt` returns null for both ENOENT and age > 120s — caller gets a single null signal regardless of cause
- `claimBuildSection` only claims `status === 'pending'` sections — won't interrupt a section that's actively being built (status='active')

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three coordination primitives are importable and tested
- Plan 02 can wire these into `start.js` (init calls), `mind/index.js` (broadcastActivity on each command), and `mind/prompt.js` (partner activity injection)
- No blockers

## Self-Check: PASSED

- `mind/taskRegistry.js` exists: FOUND
- `mind/coordination.js` exists: FOUND
- `mind/buildPlanner.js` modified: FOUND
- Commit `e31433c` exists: FOUND
- Commit `f58fe46` exists: FOUND

---
*Phase: 21-multi-agent-coordination*
*Completed: 2026-03-23*
