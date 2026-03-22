---
phase: 01-reliability
plan: 02
subsystem: agent
tags: [skills, chat, dedup, autoconnect, java-mod]

# Dependency graph
requires:
  - phase: 01-reliability
    provides: Codebase in state with known bug locations documented in plan

provides:
  - Correct skill property access in open-ended mode (getActiveSkill returns { name, content: skill.body })
  - Set-based chat deduplication immune to ring buffer cycling
  - autoConnect reset on player disconnect enabling reconnection after kicks

affects: [prompt.js, skills, chat-handling, mod-autoconnect]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Set-based dedup with positional keys: `${i}:${message}` handles identical messages at same position"
    - "wasConnected boolean tracks player connection state across ticks for disconnect edge detection"

key-files:
  created: []
  modified:
    - agent/skills.js
    - agent/index.js
    - mod/src/main/java/hermescraft/HermesBridgeMod.java

key-decisions:
  - "Return { name, content: skill.body } from non-phased branch to match phased-mode shape — callers use .content uniformly"
  - "Set keys use positional index (i:message) not just message text — handles duplicate messages at different positions correctly"
  - "wasConnected flag added to mod rather than modifying HTTP endpoint — minimizes mod API surface changes"

patterns-established:
  - "Skill return shape: always { name, content } where content is the body text — both phased and open-ended modes"
  - "Chat dedup: Set of positional keys rebuilt each tick, newMessages = filter against previous Set"

requirements-completed: [SKL-01, COM-01, COM-02]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 01 Plan 02: Reliability Bug Fixes Summary

**Three silent reliability bugs fixed: skill body access in open-ended mode, chat dedup via Set-based positional key tracking, and autoConnect reset on player disconnect/kick**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20T00:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed getActiveSkill open-ended branch returning undefined (`.content` property doesn't exist on skill objects — fixed to use `.body` and return `{ name, content: skill.body }` matching phased-mode return shape)
- Replaced hash-based chat deduplication with Set-based positional key tracking — immune to ring buffer cycling where old messages cycle out causing hash mismatches
- Added `wasConnected` field to HermesBridgeMod with per-tick disconnect detection that resets `autoConnectAttempted`, enabling reconnection after server kicks without process restart

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix skill .content vs .body mismatch (SKL-01)** - `54919b7` (fix)
2. **Task 2: Chat dedup hardening + autoconnect reset (COM-01, COM-02)** - `d9d2d83` (fix)

## Files Created/Modified
- `agent/skills.js` - Fixed getActiveSkill non-phased branch: `generalSkills[0].content` -> `{ name, content: skill.body }`
- `agent/index.js` - Replaced `lastSeenChatHash` string with `lastProcessedMessages` Set, updated dedup logic
- `mod/src/main/java/hermescraft/HermesBridgeMod.java` - Added `wasConnected` field, added disconnect detection block before auto-connect logic

## Decisions Made
- Returned `{ name, content: skill.body }` from non-phased branch (not just `skill.body` directly) to match the phased-mode return shape — callers in index.js use `activeSkill?.content` uniformly
- Used positional keys `${i}:${message}` in the Set rather than bare message text — this correctly handles cases where a player sends the same message twice (they appear at different positions, so both get processed)
- Placed disconnect detection before the auto-connect block in the tick handler — guarantees flag is reset before the connection attempt check runs on the same tick

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all three bugs had clear root causes documented in the plan with exact fix locations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Skills now correctly inject content in all modes (phased, open-ended, directed)
- Chat processing no longer double-fires on repeated ticks when no new messages arrive
- Agent auto-reconnects after kicks — no manual restart needed for transient server disconnects
- Ready for Plan 01-03 (history trimming boundary fix) or subsequent reliability work

## Self-Check: PASSED

- FOUND: .planning/phases/01-reliability/01-02-SUMMARY.md
- FOUND: agent/skills.js (modified)
- FOUND: agent/index.js (modified)
- FOUND: HermesBridgeMod.java (modified)
- FOUND commit: 54919b7 (Task 1)
- FOUND commit: d9d2d83 (Task 2)
- FOUND commit: e6e1fd8 (metadata)

---
*Phase: 01-reliability*
*Completed: 2026-03-20*
