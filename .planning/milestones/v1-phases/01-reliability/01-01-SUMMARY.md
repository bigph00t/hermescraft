---
phase: 01-reliability
plan: 01
subsystem: memory
tags: [conversation-history, context-compression, history-trim, persistence]

# Dependency graph
requires: []
provides:
  - Round-boundary-safe graduated history trim in trimHistoryGraduated
  - Corrupt tool call handler uses graduated trim instead of full wipe
  - getConversationHistory/setConversationHistory exports for cross-module persistence
  - L1 conversation history persisted to dataDir/history.json via periodicSave
  - History restored on startup with validation and corruption-safe silent catch
affects:
  - 01-02-plan (uses memory subsystem)
  - phase-02 (planning capability — requires stable context window)

# Tech tracking
tech-stack:
  added: [Node.js built-in test runner (node:test)]
  patterns:
    - Round-boundary-aware splice for conversation history trim
    - Silent-catch for non-critical filesystem writes
    - Best-effort restore pattern for crash-recovery data

key-files:
  created:
    - agent/tests/llm.test.js
  modified:
    - agent/llm.js
    - agent/memory.js

key-decisions:
  - "trimHistoryGraduated exported for testability — private helper promoted to named export"
  - "Round-boundary trim always removes complete user+assistant+(optional tool) rounds, never splitting a round mid-way"
  - "Orphaned tool messages at history front cleaned up before round detection (handles prior-bug state)"
  - "HISTORY_FILE = dataDir/history.json follows existing dataDir path pattern in memory.js"
  - "Best-effort restore: corrupted history silently discarded, agent starts fresh rather than crashing"

patterns-established:
  - "Round detection: user + assistant + optional tool = one complete round"
  - "Silent-catch pattern for periodicSave filesystem writes (non-critical I/O)"
  - "Cross-module state access: getConversationHistory/setConversationHistory as clean accessor pair"

requirements-completed: [MEM-01, MEM-02, MEM-03]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 01 Plan 01: Memory Bug Fixes Summary

**Round-boundary-safe graduated history trim, corrupt-handler full-wipe elimination, and L1 conversation history disk persistence via periodicSave/loadMemory**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T04:19:26Z
- **Completed:** 2026-03-21T04:21:52Z
- **Tasks:** 2
- **Files modified:** 3 (agent/llm.js, agent/memory.js, agent/tests/llm.test.js created)

## Accomplishments

- Fixed `trimHistoryGraduated` to remove complete conversation rounds from the front, never leaving an orphaned `tool` message at index 0 (MEM-01)
- Replaced `conversationHistory.length = 0` in the corrupt tool call error handler with `trimHistoryGraduated(0.5)` — eliminates the second full-wipe path (MEM-02)
- Added `getConversationHistory` / `setConversationHistory` / `trimHistoryGraduated` as named exports from `llm.js` for cross-module access
- Wired L1 history persistence in `memory.js`: `periodicSave` writes `history.json`, `loadMemory` restores it with validation and silent-catch for corruption (MEM-03)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests for MEM-01/MEM-02** - `bcec710` (test)
2. **Task 1 GREEN: Fix trimHistoryGraduated + corrupt handler + new exports** - `96690a6` (feat)
3. **Task 2: Persist L1 history via periodicSave/loadMemory** - `1cf1df0` (feat)

_Note: Task 1 used TDD — RED commit (failing test) then GREEN commit (implementation)_

## Files Created/Modified

- `agent/llm.js` - Round-boundary-safe trimHistoryGraduated, removed full-wipe from corrupt handler, added getConversationHistory/setConversationHistory/trimHistoryGraduated exports
- `agent/memory.js` - Added HISTORY_FILE, llm.js import, history restore in loadMemory, history write in periodicSave
- `agent/tests/llm.test.js` - 10 tests covering MEM-01 boundary safety, MEM-02 no-wipe verification, and new export contracts

## Decisions Made

- `trimHistoryGraduated` was previously unexported; promoted to named export to enable TDD and cross-module usage by memory.js
- Orphaned-tool-at-front cleanup was added as a first step in the while loop to handle pre-existing corrupt states gracefully
- History file validation requires `msg && typeof msg.role === 'string'` on every entry — rejects partially-written or truncated files

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MEM-01, MEM-02, MEM-03 all fixed and verified by automated tests
- `agent/llm.js` and `agent/memory.js` pass module load checks with no circular dependency
- Phase 2 (planning capability) can now build on a context window that: never orphans tool messages, never silently full-wipes on corrupt tool calls, and survives OOM/SIGKILL with history restored from disk

---
*Phase: 01-reliability*
*Completed: 2026-03-21*

## Self-Check: PASSED

- agent/llm.js: FOUND
- agent/memory.js: FOUND
- agent/tests/llm.test.js: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit bcec710: FOUND
- Commit 96690a6: FOUND
- Commit 1cf1df0: FOUND
