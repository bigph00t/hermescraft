---
phase: 02-planning-capability
plan: 02
subsystem: agent
tags: [planning, task-decomposition, tools, prompt-engineering, persistence]

# Dependency graph
requires:
  - phase: 02-planning-capability
    plan: 01
    provides: save_context/delete_context as INFO_ACTIONS pattern; INFO_ACTIONS dispatch wiring
provides:
  - plan_task tool: creates structured multi-step plans with subtasks, persisted to tasks.json
  - update_task tool: modifies subtask status (done/failed/in-progress/blocked) with auto-advance
  - Task state persistence to dataDir/tasks.json surviving restarts
  - == TASK PLAN == section injected into every tick's user message via buildUserMessage
affects: [03-self-review, any future agent planning or workflow phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Task state file-backed persistence pattern (TASKS_FILE, loadTaskState/saveTaskState)
    - INFO_ACTIONS dispatch extension: add tool def + VALID_ACTIONS + INFO_ACTIONS + validator + handler
    - buildUserMessage parameter extension for per-tick contextual sections

key-files:
  created: []
  modified:
    - agent/tools.js
    - agent/actions.js
    - agent/index.js
    - agent/prompt.js

key-decisions:
  - "plan_task and update_task are INFO_ACTIONS — return data to LLM, no game-world side effects"
  - "Auto-advance: when marking subtask done, next pending subtask auto-advances to in-progress"
  - "TASKS_FILE initialized in main() from agentConfig.dataDir for per-agent isolation"
  - "taskProgress injected in both tick and pipeline buildUserMessage call sites so every LLM call sees current plan status"

patterns-established:
  - "Task state functions follow same pattern as notepad: module-level let path + load/save functions + handle* function"
  - "buildUserMessage extended with optional named parameters — backwards compatible, section rendered only when non-null"

requirements-completed: [WRK-01, WRK-02]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 02 Plan 02: Task Decomposition and Per-Tick Planning Summary

**plan_task and update_task tools wired end-to-end: structured multi-step plans with subtask tracking and == TASK PLAN == progress injected into every tick's user message**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T04:42:32Z
- **Completed:** 2026-03-21T04:44:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `plan_task` tool creates goal + ordered subtask array (max 20), first subtask auto-set to in-progress, persisted to `dataDir/tasks.json`
- `update_task` tool modifies subtask status with auto-advance to next pending subtask on done; loaded from disk on every call
- `buildUserMessage` renders `== TASK PLAN ==` section with `[x]/[>]/[ ]/[!]/[B]` status markers, progress count, and `<-- CURRENT` indicator
- Both tick and pipeline `buildUserMessage` call sites pass `loadTaskState()` so the LLM sees plan status in every single invocation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plan_task and update_task tools with task state management** - `8052026` (feat)
2. **Task 2: Inject task progress into every tick's user message** - `3c7480e` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `agent/tools.js` - Added plan_task and update_task tool definitions to GAME_TOOLS
- `agent/actions.js` - Added plan_task/update_task to VALID_ACTIONS, INFO_ACTIONS, and ACTION_SCHEMAS validators
- `agent/index.js` - Added TASKS_FILE, loadTaskState, saveTaskState, handlePlanTask, handleUpdateTask; wired dispatch; set TASKS_FILE in main(); pass taskProgress in both buildUserMessage call sites
- `agent/prompt.js` - Added taskProgress parameter and == TASK PLAN == section rendering in buildUserMessage

## Decisions Made

- plan_task and update_task are INFO_ACTIONS — return data to LLM with no game-world side effects, consistent with save_context/delete_context pattern from Plan 01
- Auto-advance: marking a subtask `done` automatically sets the next `pending` subtask to `in-progress`, so the agent always has a clear current target
- TASKS_FILE initialized in `main()` from `agentConfig.dataDir` for per-agent isolation (same pattern as NOTEPAD_FILE)
- taskProgress injected at both `buildUserMessage` call sites (main tick + pipeline pre-computation) so the LLM never misses its plan status

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Planning capability complete: agent can now break complex instructions into subtasks and track completion each tick
- Phase 03 (self-review) can build on top of the task state — e.g. auto-review triggered on all subtasks `done`
- No blockers

## Self-Check

- [x] `agent/tools.js` plan_task and update_task present in GAME_TOOLS
- [x] `agent/actions.js` plan_task and update_task in INFO_ACTIONS and VALID_ACTIONS
- [x] `agent/index.js` has handlePlanTask, handleUpdateTask, loadTaskState, saveTaskState
- [x] `agent/prompt.js` renders == TASK PLAN == with all status markers
- [x] Commits 8052026 and 3c7480e exist

---
*Phase: 02-planning-capability*
*Completed: 2026-03-21*
