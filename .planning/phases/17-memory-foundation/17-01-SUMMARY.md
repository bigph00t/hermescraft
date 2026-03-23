---
phase: 17-memory-foundation
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, episodic-memory, importance-scoring, spatial-tagging]

# Dependency graph
requires:
  - phase: 16-vision-system
    provides: mind/index.js death handler and dispatch patterns wired for new hooks

provides:
  - mind/memoryDB.js SQLite event log with 5 named exports (initMemoryDB, logEvent, queryRecent, queryNearby, pruneOldEvents)
  - better-sqlite3 installed in package.json
  - Persistent events table: id, agent, ts, event_type, importance, x, z, dimension, description, metadata
  - Stanford Generative Agents importance scoring: death=10, discovery=8, combat=7, build=6, social=5, craft=4, observation=3, movement=2
  - FIFO pruning at startup (default 10,000 events per agent)
  - initMemoryDB called in start.js step 3
  - logEvent wired into mind/index.js: death handler, dispatch success, design success
  - Section 20 smoke tests covering exports, functional SQLite operations, spatial queries, source wiring

affects:
  - 18-memory-retrieval (MEM-02): queryRecent + queryNearby power prompt injection
  - future-phases: episodic memory foundation for all experience logging

# Tech tracking
tech-stack:
  added:
    - better-sqlite3 ^12.8.0 — synchronous SQLite with WAL mode
  patterns:
    - Module-level db singleton (let db = null) initialized by init<Subsystem>(config) — matches mind/memory.js pattern
    - Prepared statement at module level (_insertStmt) created in initMemoryDB, not in logEvent per-call
    - Null guard pattern: if (!db) return — safe before init and in tests
    - IMPORTANCE const lookup table at module level — no LLM call for scoring, heuristic only
    - Dimension normalization: replace('minecraft:', '') for consistent values regardless of Mineflayer version

key-files:
  created:
    - mind/memoryDB.js — SQLite event log with full CRUD API (5 exports)
  modified:
    - package.json — better-sqlite3 added as dependency
    - package-lock.json — lockfile updated
    - start.js — initMemoryDB imported and called after loadMemory() in step 3
    - mind/index.js — logEvent imported; wired into death handler, dispatch success (EVT_MAP), design success
    - tests/smoke.test.js — Section 20 Memory DB added (export validation, functional test, source assertions)

key-decisions:
  - "Use config.name (_agentName module var) as agent column, not bot.username — consistent per-agent filtering even when MC username differs"
  - "Log logEvent from mind/index.js only (has bot reference for spatial coords), not mind/memory.js (no bot access)"
  - "Dispatch EVT_MAP covers: build/design->build, mine/gather->discovery, combat->combat, craft/smelt->craft, chat->social, navigate->movement; fallback to observation"
  - "WAL mode + synchronous=NORMAL for crash safety without performance penalty"
  - "FIFO pruning runs at initMemoryDB startup, never per-tick — zero overhead in the game loop"

patterns-established:
  - "SQLite module singleton: let db = null, initialized by initMemoryDB(config), null-guarded in all functions"
  - "Event importance scored at write time via IMPORTANCE const lookup (no async LLM call)"
  - "All spatial coords rounded to integer (Math.round) before storage"

requirements-completed: [MEM-01, MEM-03, SPA-03]

# Metrics
duration: ~5min
completed: 2026-03-23
---

# Phase 17 Plan 01: Memory Foundation Summary

**SQLite persistent event log (better-sqlite3) with Stanford Generative Agents importance scoring (death=10 to movement=2), spatial coordinate tagging, and FIFO pruning — wired into start.js init + mind/index.js lifecycle hooks**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T21:18:38Z
- **Completed:** 2026-03-23T21:21:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `mind/memoryDB.js` with 5 named exports implementing the full SQLite event log API — initMemoryDB, logEvent, queryRecent, queryNearby, pruneOldEvents
- Wired initMemoryDB into start.js step 3 (after loadMemory) and logEvent into 3 mind/index.js lifecycle hooks: death handler, dispatch success, design success
- Added Section 20 to smoke.test.js with functional SQLite test (temp dir, 3 events, importance verification, spatial queries) — all 419 tests passing

## Task Commits

1. **Task 1: Install better-sqlite3 and create mind/memoryDB.js** - `6141c2c` (feat)
2. **Task 2: Wire memoryDB into startup, lifecycle hooks, and smoke tests** - `1760e59` (feat)

## Files Created/Modified

- `mind/memoryDB.js` — New: SQLite event log module with 5 exports, WAL mode, importance scoring, spatial tagging
- `package.json` — Modified: better-sqlite3 ^12.8.0 added to dependencies
- `package-lock.json` — Modified: lockfile updated with better-sqlite3 and its native bindings
- `start.js` — Modified: import + call initMemoryDB(config) after loadMemory() in step 3
- `mind/index.js` — Modified: import logEvent; wired into death handler, dispatch success (EVT_MAP), design success
- `tests/smoke.test.js` — Modified: Section 20 Memory DB added with 16 assertions

## Decisions Made

- **agent column = config.name, not bot.username** — consistent per-agent filtering; bot.username is the MC username and can differ from agent name (e.g., "luna" vs "LunaBot_1")
- **logEvent only in mind/index.js** — mind/memory.js has no bot reference, so death events logged from the death handler in index.js where bot position is available (spatially tagged)
- **EVT_MAP for dispatch** — build/design -> build, mine/gather -> discovery, combat -> combat, craft/smelt -> craft, chat -> social, navigate -> movement; unrecognized commands default to observation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 17 complete: SQLite event log is live, accumulating deaths, builds, discoveries, and crafts with importance scores and spatial coordinates
- Phase 18 (MEM-02) can directly use queryRecent() and queryNearby() for prompt injection
- No blockers — better-sqlite3 has pre-built Linux x64 binaries, no native compilation needed

---
*Phase: 17-memory-foundation*
*Completed: 2026-03-23*
