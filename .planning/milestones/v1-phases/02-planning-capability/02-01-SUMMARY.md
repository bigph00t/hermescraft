---
phase: 02-planning-capability
plan: 01
subsystem: agent-memory
tags: [tools, skills, context, planning, scoring]

# Dependency graph
requires: []
provides:
  - save_context tool: agent can write persistent planning documents to dataDir/context/ (survives memory wipes)
  - delete_context tool: agent can remove context documents
  - multi-signal getActiveSkill: automatic skill selection based on phase, goal keywords, game state health/time
affects:
  - 02-planning-capability
  - 03-self-review

# Tech tracking
tech-stack:
  added: []
  patterns:
    - INFO_ACTIONS dispatch pattern extended with context file read/write handlers
    - Multi-signal scoring function (scoreSkill) with weighted signals (phase=100, keyword=30, health=50, survival night=20, success_rate tiebreaker)
    - Keyword bank per skill category (SKILL_KEYWORDS) for goal text matching

key-files:
  created: []
  modified:
    - agent/tools.js
    - agent/actions.js
    - agent/index.js
    - agent/skills.js

key-decisions:
  - "save_context and delete_context are INFO_ACTIONS — return data to LLM, no game-world side effects"
  - "Path traversal protection via regex strip of / and \\ from filenames before join"
  - "File count checked only for NEW files (overwrite is always allowed)"
  - "getActiveSkill accepts optional { mode, goalText, gameState } — backwards compatible default {} arg"
  - "scoreSkill: phase match = 100 pts (strongest for phased), goal keyword category overlap = 30 pts each, health < 10 combat boost = 50, night survival boost = 20, success_rate * 5 as tiebreaker"

patterns-established:
  - "Persistent context handler pattern: validate extension → sanitize path → check limits → write file"
  - "Scoring function receives full context bundle (phase, mode, goalText, gameState) via destructured options object"

requirements-completed: [MEM-04, SKL-02]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 2 Plan 01: Planning Capability Foundation Summary

**save_context tool wired end-to-end (tools.js → actions.js → index.js → disk) plus multi-signal getActiveSkill scoring on phase ID, goal keywords, game state health/time, and success rate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T04:38:21Z
- **Completed:** 2026-03-21T04:40:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- save_context and delete_context tools are defined in GAME_TOOLS, registered in VALID_ACTIONS and INFO_ACTIONS, and handled in index.js with filename validation, path traversal protection, file count limit (5), char limit (8000)
- delete_context removes files from dataDir/context/ with safe path join and existence check
- getActiveSkill upgraded from single-arg to multi-signal scoring: phase match, 7-category keyword banks, game state (health, time-of-day), success_rate tiebreaker
- Call site in index.js now passes _agentConfig.mode, goal text, and current game state on every tick

## Task Commits

Each task was committed atomically:

1. **Task 1: Add save_context tool and wire it end-to-end** - `8068c6c` (feat)
2. **Task 2: Upgrade getActiveSkill to multi-signal automatic selection** - `4f0544e` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `agent/tools.js` - Added save_context and delete_context tool definitions to GAME_TOOLS array
- `agent/actions.js` - Added both tools to VALID_ACTIONS, INFO_ACTIONS, and ACTION_SCHEMAS validators
- `agent/index.js` - Added readdirSync/unlinkSync imports; handleSaveContext and handleDeleteContext functions; dispatch branches in INFO_ACTIONS block; updated getActiveSkill call with { mode, goalText, gameState }
- `agent/skills.js` - Replaced getActiveSkill(phase) with getActiveSkill(phase, opts); added SKILL_KEYWORDS banks; added scoreSkill scoring function

## Decisions Made

- save_context uses same limits as loadPinnedContext (5 files, 8000 chars) to keep them in sync
- File count checked only for NEW files — overwriting an existing file always allowed (no limit bypass since file count stays the same)
- scoreSkill uses phase match as strongest signal (100 pts) so phased mode is not degraded
- getActiveSkill signature remains backwards compatible (default `{}` for opts parameter)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — both tools are fully wired end-to-end. save_context writes to disk immediately; loadPinnedContext injects written files into system prompt next tick.

## Next Phase Readiness

- Agent can now write persistent planning documents that survive conversation wipes (MEM-04)
- Skill selection now considers goal text and game state, not just phase ID (SKL-02)
- Ready for Plan 02: task decomposition loop built on top of save_context for plan tracking

---
*Phase: 02-planning-capability*
*Completed: 2026-03-21*
