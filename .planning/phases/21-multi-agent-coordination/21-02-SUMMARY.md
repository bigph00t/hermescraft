---
phase: 21-multi-agent-coordination
plan: 02
subsystem: coordination
tags: [multi-agent, chat-loop-prevention, activity-broadcast, section-claiming, prompt-injection, smoke-tests]

# Dependency graph
requires:
  - 21-01  # taskRegistry.js, coordination.js, buildPlanner section claiming
provides:
  - "start.js: wires initTaskRegistry + initCoordination into startup sequence (COO-01)"
  - "mind/index.js: chat loop prevention counter with reset on real skill success (COO-02)"
  - "mind/index.js: broadcastActivity before and after every dispatch (COO-04)"
  - "mind/index.js: claimBuildSection auto-claim before build dispatch (COO-03)"
  - "mind/prompt.js: partnerActivity injection in buildSystemPrompt (COO-04)"
  - "mind/prompt.js: chatLimitWarning injection in buildUserMessage (COO-02)"
  - "tests/smoke.test.js: 40 new assertions covering all COO-01 through COO-04 contracts"
affects:
  - agent runtime — all dispatched commands now broadcast activity
  - agent prompts — partner activity visible in every system prompt
  - agent chat behavior — chat loop prevention active after 3 consecutive chats

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chat loop prevention: module-level counter incremented on !chat, reset only on successful non-chat non-idle dispatch"
    - "Dual broadcast: activity broadcasted as 'running' before dispatch and 'complete/failed' after"
    - "Spatial-aware smoke mock: _makeMockVec3 helper with floored()+offset() for buildUserMessage testing"

key-files:
  created: []
  modified:
    - start.js
    - mind/index.js
    - mind/prompt.js
    - tests/smoke.test.js

key-decisions:
  - "Broadcast fires twice per dispatch: 'running' before and 'complete'/'failed' after — gives partner real-time start + end visibility"
  - "claimBuildSection only triggers when activePlan has >1 section — single-section plans don't need claiming"
  - "chatLimitWarning injects into user message (not system prompt) — it's context for the current decision, not global identity"
  - "partnerActivity Part 5.13 placed after buildPlanContext — build coordination context is more architectural, partner activity is dynamic"
  - "buildUserMessage smoke test uses _makeMockVec3 to satisfy spatial.js floored()+offset() requirements"

requirements-completed: [COO-01, COO-02, COO-03, COO-04]

# Metrics
duration: 184s
completed: 2026-03-23
---

# Phase 21 Plan 02: Multi-Agent Coordination Wiring Summary

**Coordination modules wired live: chat loop prevention, activity broadcasting, section claiming, and partner activity injection across startup, tick loop, and prompt**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-23T23:03:37Z
- **Completed:** 2026-03-23T23:06:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Wired `initTaskRegistry(config)` and `initCoordination(config)` into `start.js` after `initBuildPlanner` — both coordination modules now initialize at bot startup
- Added `_consecutiveChatCount` module-level counter in `mind/index.js`: increments on every `!chat` dispatch, resets to 0 only on successful non-chat non-idle dispatch — prevents LLM from chat-looping forever
- Added dual `broadcastActivity` calls per dispatch: `'running'` before the `dispatch()` call so partner sees real-time start, `'complete'/'failed'` after so partner sees outcome
- Added `claimBuildSection` call before `build` dispatch when `activePlan.sections.length > 1` — prevents two agents building the same section simultaneously
- Added `partnerActivity: getPartnerActivityForPrompt()` to the `buildSystemPrompt` options object — partner status now visible in every think() system prompt (Part 5.13)
- Added `chatLimitWarning` to `buildUserMessage` options — fires `⚠ You've sent N chats in a row. TAKE A GAME ACTION now` when count >= 3
- Added 40 smoke test assertions across 5 sections covering all COO-01 through COO-04 contracts; total smoke tests: 553 passing, 0 failed

## Task Commits

Each task committed atomically:

1. **Task 1: Wire coordination into start.js, mind/index.js, and mind/prompt.js** - `99b697c` (feat)
2. **Task 2: Add smoke test assertions for all coordination features** - `ed36472` (test)

## Files Created/Modified

- `start.js` — Added imports for initTaskRegistry, initCoordination; added init calls in startup sequence (step 3.6a)
- `mind/index.js` — Added imports for broadcastActivity, getPartnerActivityForPrompt, claimBuildSection; added _consecutiveChatCount state; wired all COO behaviors into think() dispatch block
- `mind/prompt.js` — Added Part 5.13 partnerActivity block in buildSystemPrompt; added chatLimitWarning block in buildUserMessage
- `tests/smoke.test.js` — Added 5 test sections (taskRegistry, coordination, build section claiming, prompt integration, source-level wiring) with 40 assertions

## Decisions Made

- Broadcast fires twice per dispatch (`'running'` before, `'complete'/'failed'` after) — gives the partner agent real-time start + end visibility, not just final outcome
- `claimBuildSection` only triggers when `activePlan.sections.length > 1` — single-section plans are atomic, no claiming needed
- `chatLimitWarning` goes in the user message not the system prompt — it's a per-turn override signal, not a persistent identity rule
- `partnerActivity` placed at Part 5.13 after `buildPlanContext` — build plan is structural/long-lived context; partner activity is dynamic/ephemeral, injected last among optional context
- Smoke test `buildUserMessage` calls use a `_makeMockVec3` helper that provides `floored()` and `offset()` to satisfy `spatial.js` requirements without a live bot

## Deviations from Plan

**1. [Rule 1 - Bug] buildUserMessage smoke tests needed spatial-aware mock**
- **Found during:** Task 2
- **Issue:** `buildUserMessage` → `buildStateText` → `buildSpatialAwareness` calls `bot.entity.position.floored()` which doesn't exist on the plain `mockBot` object (line 162 in smoke.test.js)
- **Fix:** Added `_makeMockVec3` helper function with `floored()` and `offset()` methods; used a `_cooMockBot` with this mock position; also added source-level assertions as fallback for robustness
- **Files modified:** `tests/smoke.test.js`
- **Commit:** `ed36472`

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required. Coordination is file-backed (data/shared/) with no additional dependencies.

## Next Phase Readiness

- All COO-01 through COO-04 requirements complete
- Phase 21 is now done — both plans complete
- Luna and Max will coordinate in practice: claiming tasks, broadcasting activity, seeing partner status, and never chat-looping
- No blockers

## Self-Check: PASSED

- `start.js` contains `initTaskRegistry(config)`: FOUND
- `start.js` contains `initCoordination(config)`: FOUND
- `mind/index.js` contains `_consecutiveChatCount`: FOUND
- `mind/prompt.js` contains `partnerActivity`: FOUND
- `mind/prompt.js` contains `chatLimitWarning`: FOUND
- Commit `99b697c` exists: FOUND
- Commit `ed36472` exists: FOUND
- Smoke tests: 553 passed, 0 failed

---
*Phase: 21-multi-agent-coordination*
*Completed: 2026-03-23*
