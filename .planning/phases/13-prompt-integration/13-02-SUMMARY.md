---
phase: 13-prompt-integration
plan: "02"
subsystem: mind
tags: [rag, retrieval, wiki, knowledge-injection, failure-recovery, minecraft]

# Dependency graph
requires:
  - phase: 12-knowledgestore
    provides: retrieveKnowledge(query, topK) returning {chunk, score}[]
  - phase: 13-01
    provides: ragContext option slot in buildSystemPrompt (Part 5.7)
provides:
  - !wiki command handler in respondToChat() (RAG-07)
  - _lastFailure failure tracking + auto-lookup on next think() cycle (RAG-08)
  - Context-aware RAG injection on every think() call (RAG-09)
  - formatRagContext / deriveRagQuery / deriveFailureQuery helper functions
  - wiki stub in REGISTRY for listCommands() completeness
affects: [mind/index.js, mind/registry.js, tests/smoke.test.js]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_lastFailure pattern: set after { success: false } dispatch, consumed (cleared) at top of next think()"
    - "deriveRagQuery returns null when no clear context — skips retrieval to save latency"
    - "deriveFailureQuery maps failed command+args to targeted query string"
    - "formatRagContext emits ## RELEVANT KNOWLEDGE header + [source] chunk pairs, 8000-char cap"
    - "!wiki handler is inside respondToChat() try block — return statements reach finally and clear _chatResponseInFlight"
    - "All retrieveKnowledge calls wrapped in try/catch — RAG failures never crash the agent"

key-files:
  created: []
  modified:
    - mind/index.js
    - mind/registry.js
    - tests/smoke.test.js

key-decisions:
  - "!wiki handler placed inline in respondToChat() before existing logic — same pattern as !design/!sethome in think()"
  - "formatRagContext lives in mind/index.js (not prompt.js) — co-located with callers; prompt.js stays pure"
  - "topK=3 for context-aware and failure queries; topK=5 for !wiki per user locked decision"
  - "deriveRagQuery returns null for chat trigger with neutral inventory — skips retrieval entirely when no context"
  - "wiki stub in REGISTRY follows same pattern as design stub — dispatch returns failure stub, real handler is elsewhere"

requirements-completed: [RAG-07, RAG-08, RAG-09]

# Metrics
duration: 2m
completed: 2026-03-23
---

# Phase 13 Plan 02: RAG Integration — think() and !wiki Wiring Summary

**Wired retrieveKnowledge into think() failure tracking, context-aware injection, and !wiki chat command with top-5 retrieval + LLM synthesis**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T04:49:56Z
- **Completed:** 2026-03-23T04:52:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **Task 1 (mind/index.js):** Added `import { retrieveKnowledge }` from knowledgeStore; added `_lastFailure` module-level state; added three internal helpers (`formatRagContext`, `deriveRagQuery`, `deriveFailureQuery`) before `think()`; modified `think()` to derive RAG query (failure-priority), call `retrieveKnowledge`, pass `ragContext` to `buildSystemPrompt`; added failure tracking after `dispatch()` returns `{ success: false }`; added `!wiki` handler at top of `respondToChat()` try block with top-5 retrieval + LLM synthesis path
- **Task 2 (registry.js + smoke.test.js):** Added `wiki` stub to REGISTRY (entry 22) following the `design` stub pattern; updated Section 2 assertion from 21 to 22 commands; added Section 16 "RAG Integration (Phase 13)" with 11 assertions covering exports, registry, wiki dispatch, and source-level pattern checks
- **All 292 smoke tests pass** (275 prior + 17 new), 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire RAG into think() with failure tracking and context-aware queries** - `d57529f` (feat)
2. **Task 2: Add wiki stub to REGISTRY and update smoke tests** - `0e634f6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `mind/index.js` — imports retrieveKnowledge; _lastFailure state; formatRagContext/deriveRagQuery/deriveFailureQuery helpers; RAG injection in think(); failure tracking after dispatch; !wiki in respondToChat()
- `mind/registry.js` — wiki stub entry (22nd command) for listCommands() completeness
- `tests/smoke.test.js` — Section 2 updated to 22 commands; Section 16 RAG Integration assertions added

## Decisions Made

- `!wiki` handler lives inline in `respondToChat()` before the normal chat LLM path — same pattern as `!sethome`/`!design` in `think()`. This keeps the special-case before normal dispatch and avoids routing through `registry.dispatch()` which has different context.
- `formatRagContext` lives in `mind/index.js` (not `prompt.js`) — co-located with its callers. `prompt.js` is a pure formatter with no imports from `mind/`; adding retrieval-adjacent helpers there would blur the boundary.
- `_lastFailure` is consumed (set to null) at the START of the next `think()` call, not at the end of the failing call. This ensures the failure info is available for the RAG query that feeds into the NEXT LLM call, which is the one where the agent needs recovery knowledge.
- `deriveRagQuery` returns `null` for chat triggers with neutral inventory — skips retrieval entirely when there is no context signal. Per the research: "Only call retrieveKnowledge when deriveRagQuery returns a non-null query."

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Self-Check: PASSED

- `mind/index.js` — FOUND
- `mind/registry.js` — FOUND
- `tests/smoke.test.js` — FOUND
- Commit `d57529f` (Task 1) — FOUND
- Commit `0e634f6` (Task 2) — FOUND
- Smoke tests: 292 passed, 0 failed

## Next Phase Readiness

- Phase 13 is now complete — all RAG requirements (RAG-07, RAG-08, RAG-09, RAG-10) implemented
- Milestone v2.2 Minecraft RAG is complete: corpus built (Phase 11), retrieval engine (Phase 12), prompt integration (Phase 13)

---
*Phase: 13-prompt-integration*
*Completed: 2026-03-23*
