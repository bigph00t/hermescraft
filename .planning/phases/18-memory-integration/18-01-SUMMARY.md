---
phase: 18-memory-integration
plan: "01"
subsystem: mind
tags: [memory, rag, episodic, reflection, sqlite, background-brain]
dependency_graph:
  requires: [17-01]
  provides: [MEM-02, MEM-04]
  affects: [mind/index.js, mind/prompt.js, mind/memoryDB.js, mind/backgroundBrain.js]
tech_stack:
  added: []
  patterns: [episodic-memory-retrieval, reflection-journal, importance-scoring]
key_files:
  created: []
  modified:
    - mind/index.js
    - mind/prompt.js
    - mind/memoryDB.js
    - mind/backgroundBrain.js
    - tests/smoke.test.js
decisions:
  - "Memory retrieval is always active (with and without RAG query) — even if ragQuery is null, memoryContext is still retrieved"
  - "queryNearby with radius=50 limit=8 is preferred; fallback to queryRecent(12) when no spatial hits"
  - "Memory context cap: 4,000 chars independent of RAG knowledge budget (2,000 token savings preserved)"
  - "Reflection journal timestamp persisted in brain-state.json (lastReflectionAt) to survive restarts"
  - "backgroundBrain.js imports logEvent directly — background brain has its own event path to SQLite"
metrics:
  duration: 153s
  completed: "2026-03-23"
  tasks: 2
  files: 5
---

# Phase 18 Plan 01: Episodic Memory Integration Summary

**One-liner:** SQLite episodic memory wired into every LLM call via queryNearby/queryRecent + background brain reflection journals stored at importance=9.

## What Was Built

**Task 1 — Memory retrieval in think() + prompt slot (MEM-02):**

- Added `queryRecent` and `queryNearby` to the import from `mind/memoryDB.js`
- Added three internal functions in `mind/index.js`:
  - `deriveMemoryQuery(bot)` — returns `{ mode: 'nearby', x, z }` when position available, else `{ mode: 'recent', limit: 12 }`
  - `retrieveMemoryContext(query)` — synchronous (better-sqlite3): calls queryNearby with 50-block radius and limit=8; falls back to queryRecent(12) on empty result
  - `formatMemoryContext(events)` — formats events as `[Nm ago at x,z] description`, caps at 4,000 chars
- Wired into `think()`: `memQuery` derived before the RAG block; `memoryContext` retrieved synchronously inside both the RAG and non-RAG code paths
- Added `memoryContext` to `buildSystemPrompt()` options in `think()`
- Added **Part 5.75** in `mind/prompt.js` between Part 5.7 (ragContext) and Part 5.8 (brainState)

**Task 2 — Reflection journals + importance entry + smoke tests (MEM-04):**

- Added `reflection: 9` to IMPORTANCE map in `mind/memoryDB.js` (between death=10 and discovery=8)
- Added `import { logEvent } from './memoryDB.js'` to `mind/backgroundBrain.js`
- Added `REFLECTION_INTERVAL_MS = 30 * 60 * 1000` constant
- Added `generateReflectionJournal(recentHistory)` function — calls bgClient for a 1-2 sentence tactical summary, stores via `logEvent(_bot, 'reflection', summary, { source: 'background_brain' })`
- Wired into `runBackgroundCycle()` after `writeBrainState(mergedState)`: checks `mergedState.lastReflectionAt`, fires journal if > 30min elapsed, persists timestamp back to brain-state.json
- Added **Section 21** in `tests/smoke.test.js` (15 assertions covering all MEM-02 and MEM-04 source wiring)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken pre-existing smoke test after import expansion**
- **Found during:** Task 1 verification
- **Issue:** Section 20 test checked `_indexSrc.includes("import { logEvent }")` — exact match failed after we expanded the import to `import { logEvent, queryRecent, queryNearby }`
- **Fix:** Updated assertion to `_indexSrc.includes("logEvent") && _indexSrc.includes("from './memoryDB.js'")` — semantically equivalent, robust to import expansion
- **Files modified:** tests/smoke.test.js (line 751)
- **Commit:** 486fddd (part of Task 1 commit)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 486fddd | feat(18-01): episodic memory retrieval in think() + prompt slot (MEM-02) |
| Task 2 | 8c26ea0 | feat(18-01): reflection journals + importance=9 + Section 21 smoke tests (MEM-04) |

## Test Results

- Before: 419 tests passing, 0 failed
- After Task 1: 419 tests passing, 0 failed (fixed 1 pre-existing assertion)
- After Task 2: 434 tests passing, 0 failed (15 new Section 21 assertions)

## Known Stubs

None — all memory retrieval and reflection wiring is fully functional. Memory injection requires a live SQLite DB (initialized by initMemoryDB); returns null gracefully if DB not initialized (cold start).

## Self-Check: PASSED

All modified files present. Both task commits verified in git log.
