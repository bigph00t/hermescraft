---
phase: 03-self-review-loop
plan: 01
subsystem: agent
tags: [task-management, self-review, retry-logic, game-state, prompt]

requires:
  - phase: 02-planning-capability
    provides: tasks.json structure, loadTaskState/saveTaskState, update_task tool, TASK PLAN prompt section

provides:
  - pendingReview bridge: deferred review queued one tick after marking subtask done with expected_outcome
  - reviewSubtaskOutcome function: keyword-checks inventory/position/health against expected_outcome
  - retry tracking: retry_count/max_retries on subtasks, blocks at 2 retries with auto-advance
  - REVIEW PASSED / REVIEW FAILED banner in agent prompt
  - [?] reviewing status marker and <-- VERIFYING... indicator in TASK PLAN section
  - retry count display in TASK PLAN subtask lines

affects: [04-pre-execution-validation, any phase that uses plan_task/update_task tools]

tech-stack:
  added: []
  patterns:
    - "One-tick-delayed review: pendingReview stores expected_outcome, reviewSubtaskOutcome fires on next tick"
    - "Keyword-based state comparison: inventory item names, coordinate proximity (<5 blocks), health thresholds"
    - "Retry escalation: in-progress on failure, blocked after max_retries=2"
    - "Review result injected into prompt via reviewResult param to buildUserMessage"

key-files:
  created: []
  modified:
    - agent/index.js
    - agent/prompt.js
    - agent/tools.js

key-decisions:
  - "One-tick delay between marking done and verification prevents stale state reads"
  - "Keyword-based checks (not LLM call) keep review cost-free — no extra API calls"
  - "Default: no keywords matched means pass — trusts agent judgment, reduces false negatives"
  - "retry_count and max_retries stored on subtask object in tasks.json for persistence"
  - "REVIEW FAILED banner includes expected vs actual and explicit 'Try a DIFFERENT approach' instruction"

patterns-established:
  - "pendingReview pattern: store intent at action time, evaluate at next tick when state is fresh"
  - "Subtask lifecycle: pending -> in-progress -> reviewing -> done|failed -> (retry or blocked)"

requirements-completed: [WRK-03, WRK-04]

duration: 8min
completed: 2026-03-21
---

# Phase 03 Plan 01: Self-Review Loop Summary

**Keyword-based subtask outcome review with one-tick delay, retry tracking (max 2), and REVIEW PASSED/FAILED banners injected into the agent's TASK PLAN prompt section**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T04:57:34Z
- **Completed:** 2026-03-21T05:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- handleUpdateTask extended with `expected_outcome` param: sets subtask to `reviewing` status and queues `pendingReview` for next-tick verification instead of immediate done
- `reviewSubtaskOutcome(state)` function: checks inventory item presence, position proximity (5-block threshold), and health thresholds against expected_outcome keywords; defaults to pass when no keywords match
- Retry logic: failed reviews increment `retry_count`; at `max_retries=2` the subtask is blocked and next pending subtask auto-advances
- Agent prompt shows `[?]` marker and `<-- VERIFYING...` for reviewing subtasks, retry counts like `(retry 1/2)`, and bold REVIEW PASSED / REVIEW FAILED banners after the task list
- `tools.js` update_task definition now includes `expected_outcome` parameter documentation for the LLM

## Task Commits

1. **Task 1: Add expected_outcome, retry tracking, reviewSubtaskOutcome** - `ef50b81` (feat)
2. **Task 2: Display review results and retry context in prompt** - `69aa9ba` (feat)

## Files Created/Modified

- `agent/index.js` - pendingReview variable, extended handleUpdateTask, reviewSubtaskOutcome function, tick() integration, reviewResult passed to buildUserMessage
- `agent/prompt.js` - reviewResult param, [?] marker, retry count display, REVIEW PASSED/FAILED banner
- `agent/tools.js` - expected_outcome parameter added to update_task tool definition

## Decisions Made

- Keyword-based review (not LLM call): keeps review cost-zero and fast, runs in the existing tick loop
- Default-pass when no keywords match: trusts agent's judgment, avoids false negatives that would frustrate the agent unnecessarily
- One-tick delay: ensures the game state read reflects the outcome of the just-completed action, not stale pre-action state
- Retry tracking stored in tasks.json: persistent across restarts, visible in the prompt

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Self-review loop is complete: agent marks subtask for review, next tick verifies game state, retries on failure, blocks after 2 failures
- Ready for Phase 03 Plan 02 (pre-execution validation) or downstream phases
- The `reviewing` status and `retry_count` fields in tasks.json are live; existing plans will benefit immediately

---
*Phase: 03-self-review-loop*
*Completed: 2026-03-21*
