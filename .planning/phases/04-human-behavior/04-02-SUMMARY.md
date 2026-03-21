---
phase: 04-human-behavior
plan: 02
subsystem: agent
tags: [behavior-mode, idle-detection, prompt-engineering, human-like, socialization]

# Dependency graph
requires:
  - phase: 04-human-behavior/01
    provides: detectBehaviorMode, calculateNeeds, formatNeedsForPrompt from needs.js
provides:
  - Behavior-mode-specific prompt hints (work/shelter/social/sleep guidance)
  - Idle tick tracking and boredom hint injection in action loop
  - idleHint parameter in buildUserMessage for dynamic idle nudges
affects: [agent-loop, prompt-builder, future-personality-work]

# Tech tracking
tech-stack:
  added: []
  patterns: [behavior-mode-aware-prompting, idle-tick-tracking, mode-specific-llm-guidance]

key-files:
  created: []
  modified:
    - agent/prompt.js
    - agent/index.js

key-decisions:
  - "Behavior hints injected after CURRENT STRATEGY section in system prompt for contextual layering"
  - "Idle hint placed before GAME STATE in user message so LLM sees it early"
  - "meaningfulActions set determines what resets idle counter — only game-world-changing actions count"
  - "idleTicks reset on all clearConversation calls to prevent stale boredom state"

patterns-established:
  - "Mode-specific prompt injection: behavior hints keyed by mode string, injected conditionally"
  - "Idle tick tracking: counter incremented on non-meaningful actions, reset on meaningful success"

requirements-completed: [BEHAV-02, BEHAV-04]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 04 Plan 02: Behavior-Aware Prompts Summary

**Mode-specific behavior hints (work/shelter/social/sleep) in system prompt and idle tick tracking with boredom nudges in action loop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T06:27:53Z
- **Completed:** 2026-03-21T06:30:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- buildSystemPrompt now accepts behaviorMode param and injects mode-specific guidance text (work productivity with human pauses, shelter urgency, social night-time chat, sleep wind-down)
- buildUserMessage accepts idleHint param for dynamic boredom nudges injected before game state
- Action loop tracks idle ticks, computes behavior mode each tick, and generates context-appropriate idle hints (5+ idle work ticks, 3+ idle social ticks)
- idleTicks counter resets on meaningful successful actions and all conversation clears (death, stuck, phase transition)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add behavior mode and idle/social hints to prompt.js** - `15c948d` (feat)
2. **Task 2: Add idle tick tracking and behavior mode to index.js action loop** - `e347689` (feat)

## Files Created/Modified
- `agent/prompt.js` - Extended buildSystemPrompt with behaviorMode param and HOW TO BEHAVE section; extended buildUserMessage with idleHint param and IDLE section
- `agent/index.js` - Import detectBehaviorMode from needs.js, module-level idleTicks tracker, behaviorMode computation per tick, idle hint generation, idleTicks reset on conversation clears

## Decisions Made
- Behavior hints injected after CURRENT STRATEGY section in system prompt -- this ensures the planner's strategic context is read first, then behavioral nudges layer on top
- Idle hint placed before GAME STATE in user message so the LLM encounters the boredom nudge before seeing current state, making it more likely to act on it
- meaningfulActions set includes only game-world-changing actions (mine, navigate, craft, place, build, farm, harvest, equip, break_block, fish, breed, interact_entity, interact_block) -- info actions like notepad, recipes, chat don't count as "doing something"
- idleTicks counter reset on all four clearConversation call sites to prevent stale boredom state after death/stuck/phase-transition recovery

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 04 (Human-Like Behavior) fully complete: needs system + behavior modes (plan 01) and behavior-aware prompts + idle tracking (plan 02)
- Agent now has full day/night behavior cycle awareness and will receive idle nudges when inactive
- Ready for Phase 05 (Automatic Skill Learning) or other planned phases

## Self-Check: PASSED

- agent/prompt.js: FOUND
- agent/index.js: FOUND
- 04-02-SUMMARY.md: FOUND
- Commit 15c948d: FOUND (feat(04-02): add behavior mode and idle hints to prompt builder)
- Commit e347689: FOUND (feat(04-02): add idle tick tracking and behavior mode to action loop)

---
*Phase: 04-human-behavior*
*Completed: 2026-03-21*
