---
phase: 04-human-behavior
plan: 01
subsystem: behavior
tags: [needs-system, behavior-mode, day-night-cycle, planner, game-state]

# Dependency graph
requires:
  - phase: 03-deep-memory
    provides: "autobiography events, social relationships, chat history, locations/home"
provides:
  - "detectBehaviorMode(state) — work/shelter/social/sleep from MC time ticks"
  - "calculateNeeds(state, socialState) — hunger/safety/social/creative scores 0-100"
  - "formatNeedsForPrompt(needs) — single-line summary for LLM injection"
  - "Planner loop injects behavior mode and needs into strategy generation"
affects: [04-02-idle-behavior, action-loop, prompt-system]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pure calculation module pattern (no imports, caller passes all data)", "behavior mode as planner context injection"]

key-files:
  created: ["agent/needs.js"]
  modified: ["agent/planner.js"]

key-decisions:
  - "needs.js is a pure calculation module with zero imports — planner.js passes all data as arguments"
  - "Behavior mode injected into both system prompt and user content for maximum LLM awareness"
  - "Social time section only added when in social mode AND nearby players exist"
  - "Home position passed to needs calculation for night-away-from-home safety penalty"

patterns-established:
  - "Pure calculation modules: domain logic in standalone files, integrated by callers"
  - "Behavior mode context injection: planner writes mode-aware strategy for action loop"

requirements-completed: [BEHAV-01, BEHAV-03]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 04 Plan 01: Needs System and Behavior Mode Summary

**Needs scoring system (hunger/safety/social/creative 0-100) with time-based behavior modes (work/shelter/social/sleep) injected into planner loop every 60s tick**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T06:23:19Z
- **Completed:** 2026-03-21T06:25:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created agent/needs.js with pure calculation functions for behavior mode detection and four-axis needs scoring
- Integrated needs and behavior mode into planner.js so every 60s strategy update reflects current behavioral priorities
- Added social time emphasis when agent is in shelter at night near other players (D-07, D-08)
- Urgency overrides inject immediate-action directives when hunger, safety, or social needs are critical

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent/needs.js** - `cf89429` (feat)
2. **Task 2: Integrate needs + behavior mode into planner.js** - `73d1364` (feat)

## Files Created/Modified
- `agent/needs.js` - Pure calculation module: detectBehaviorMode, calculateNeeds, formatNeedsForPrompt
- `agent/planner.js` - Extended plannerTick with behavior mode computation, needs injection into system and user prompts, social time section

## Decisions Made
- needs.js has zero imports from other agent modules — the planner passes state and social data as arguments, keeping the module pure and testable
- Behavior mode injected into both system prompt (as rules) and user content (as status) so the LLM sees it from both perspectives
- Social time section only appears when behaviorMode is "social" AND nearbyPlayers.length > 0 — avoids noise when alone
- Home position from getHome() passed to calculateNeeds for the night-away-from-home safety penalty calculation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Needs system and behavior mode are live in the planner loop
- Plan 04-02 (idle behavior, emotional state) can build on the behavior mode context
- Action loop (index.js) already reads plan-context.txt — behavior-aware strategies will naturally influence action selection

## Self-Check: PASSED

- agent/needs.js: FOUND
- agent/planner.js: FOUND
- 04-01-SUMMARY.md: FOUND
- Commit cf89429: FOUND (Task 1)
- Commit 73d1364: FOUND (Task 2)

---
*Phase: 04-human-behavior*
*Completed: 2026-03-21*
