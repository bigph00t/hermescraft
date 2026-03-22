---
phase: 03-mind-loop-llm
plan: "02"
subsystem: mind
tags: [event-loop, mind-loop, chat-trigger, idle-timer, think-dispatch, entry-point]
dependency_graph:
  requires:
    - mind/llm.js
    - mind/prompt.js
    - mind/registry.js
    - body/bot.js
    - body/interrupt.js
  provides:
    - mind/index.js
    - start.js
  affects:
    - Phase 04+ — all agents launch via start.js; mind/index.js is the central loop
tech_stack:
  added: []
  patterns:
    - "Event-driven loop: chat/skill_complete/idle triggers all funnel into a single think() function — no fixed tick"
    - "thinkingInFlight + skillRunning boolean guards prevent double-dispatch without queuing or artificial cooldowns"
    - "setTimeout(0) after dispatch schedules skill_complete think in next event loop iteration so finally block runs first"
    - "500ms idle sentinel interval is poll-only — does NOT cap LLM call frequency"
key_files:
  created:
    - mind/index.js
    - start.js
  modified:
    - package.json
key-decisions:
  - "skill_complete re-think uses setTimeout(0) not direct recursion — ensures thinkingInFlight is cleared in finally before the next think() fires"
  - "skillRunning reset in both the normal path and finally block — catches dispatch() throws that exit before the explicit reset"
  - "chat filter uses bot.players?.[sender]?.username fallback to sender.toString().slice(0,8) — handles both UUID and raw username sender formats"
  - "start.js error handlers registered AFTER initMind() — avoids intercepting spawn/connect errors as uncaught exceptions during startup"
patterns-established:
  - "Entry point pattern: createBot() then initMind(bot) — simple two-call startup for any v2 agent"
  - "Mind loop never imports body/ directly — registry.js is the only crossing point of the Mind/Body boundary"
requirements-completed: [MIND-01, MIND-04]
duration: 1m 30s
completed: "2026-03-22"
---

# Phase 03 Plan 02: Mind Loop Assembly Summary

**Event-driven Mind loop wiring chat/skill_complete/idle into think() -> queryLLM() -> dispatch(), plus v2 entry point `start.js` connecting Mind + Body**

## Performance

- **Duration:** 1m 30s
- **Started:** 2026-03-22T18:28:18Z
- **Completed:** 2026-03-22T18:29:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `mind/index.js` registers three event sources (chat, skill_complete via setTimeout(0), idle via 500ms sentinel) that all call into a single `think()` function
- `think()` uses `thinkingInFlight` and `skillRunning` boolean guards to prevent concurrent LLM queries and double skill dispatch without any artificial delays or caps
- `start.js` is the v2 runnable entry point: `createBot()` then `initMind(bot)` — two calls to bring the full agent alive
- `package.json` now has `start:v2` script pointing at `start.js`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mind/index.js (event-driven Mind loop)** - `3b3525f` (feat)
2. **Task 2: Create start.js (v2 entry point) + add start:v2 script** - `9dd78a8` (feat)

## Files Created/Modified

- `mind/index.js` — Event-driven loop: chat/skill_complete/idle -> think() -> queryLLM() -> dispatch()
- `start.js` — v2 entry point: createBot() + initMind(bot) + global error handlers
- `package.json` — Added `start:v2: node start.js` script

## Decisions Made

- `skill_complete` re-think uses `setTimeout(0)` not direct recursion — ensures `thinkingInFlight = false` runs in the `finally` block before the next `think()` call fires. Direct recursion inside the `try` block would never clear the guard.
- `skillRunning = false` appears in both the normal path (after `dispatch()`) and the `finally` block — if `dispatch()` throws, the `finally` catches it and still resets the guard.
- chat message filter: `bot.players?.[sender]?.username || sender.toString().slice(0, 8)` — the `messagestr` event sender may be a UUID string or a username depending on the MC version/plugin.
- Global error handlers registered after `initMind(bot)` so startup connection errors propagate naturally to the outer `main().catch()` instead of being silently swallowed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Full v2 agent is runnable: `npm run start:v2` connects to MC and starts the event-driven loop
- Phase 03 is complete — all three plans done (03-01 core modules, 03-02 assembly + entry point)
- Phase 04 can extend `mind/index.js` with SOUL file loading, multi-agent coordination, and memory persistence

---
*Phase: 03-mind-loop-llm*
*Completed: 2026-03-22*
