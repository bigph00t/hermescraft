---
phase: 02-spatial-awareness-architecture
plan: 04
subsystem: agent
tags: [chat-ownership, dedup, planner, action-queue, surface-blocks]

requires:
  - phase: 02-02
    provides: "Agent code cleanup, surface-first gameplay instructions"
provides:
  - "Planner-only chat ownership (action loop blocks LLM chat)"
  - "Chat dedup with >50% word overlap detection"
  - "Surface-first QUEUE prompt with look_at_block + break_block"
affects: [agent-behavior, chat-system, action-queue]

tech-stack:
  added: []
  patterns: ["Chat ownership: planner sends, action loop blocks", "Surface-first queue prompting"]

key-files:
  created: []
  modified:
    - agent/index.js
    - agent/planner.js

key-decisions:
  - "Action loop chat block uses isBaritoneActive() exception rather than response tagging"
  - "Chat from queue (mode=queue) allowed through -- planner explicitly queued it"

patterns-established:
  - "D-16 chat ownership: planner.js sends chat via Say: lines, index.js blocks LLM chat with completeToolCall redirect"
  - "Surface-first prompting: QUEUE examples show look_at_block + break_block before mine"

requirements-completed: [ARC-04, ARC-05]

duration: 4min
completed: 2026-03-21
---

# Phase 02 Plan 04: Chat Ownership and Surface-First Queue Summary

**Planner-only chat via D-16 hard block in action loop, surface-first QUEUE prompt with look_at_block + break_block examples**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T22:15:53Z
- **Completed:** 2026-03-21T22:20:01Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Action loop now blocks all LLM-generated chat actions, redirecting to planner via completeToolCall
- Three exception paths preserved: emergency/drowning (line 729), follow-me (line 797), Baritone-active chat (section B)
- QUEUE prompt example updated from mine-only to surface-first (look_at_block + break_block)
- Valid types list updated to include look_at_block
- Surface blocks consideration added to planner "Consider:" section

## Task Commits

Each task was committed atomically:

1. **Task 1: Restrict action loop chat + enhance planner dedup** - `4f90cc9` (feat)

**Plan metadata:** [pending final commit] (docs: complete plan)

## Files Created/Modified
- `agent/index.js` - Replaced soft chat limiter with D-16 hard block; exceptions for queue, Baritone-active, emergency, follow-me
- `agent/planner.js` - Updated QUEUE example to surface-first, added look_at_block to valid types, added surfaceBlocks to Consider section

## Decisions Made
- Used `!isBaritoneActive()` as the Baritone exception condition rather than tagging responses -- cleaner since Baritone state is already tracked centrally
- Chat from queue (`response.mode !== 'queue'`) passes through since the planner explicitly queued it
- Verified existing dedup (>50% word overlap on last 5 messages) and Say: regex (double-quote only) are correct per D-17/D-19 -- no changes needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added isBaritoneActive() exception to chat block**
- **Found during:** Task 1 (post-implementation review)
- **Issue:** Plan's code `response.mode !== 'queue'` would also block chat during Baritone-active (section B), contradicting the plan's own exception list
- **Fix:** Added `&& !isBaritoneActive()` to the condition
- **Files modified:** agent/index.js
- **Verification:** Section B chat-only tools path now correctly passes through
- **Committed in:** 4f90cc9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correct Baritone-active chat behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 complete: all 4 plans executed
- Surface block detection, brain-hands-eyes architecture, Baritone settings, and chat ownership all in place
- Ready for Phase 03 (server integration / plugin stack)

---
*Phase: 02-spatial-awareness-architecture*
*Completed: 2026-03-21*
