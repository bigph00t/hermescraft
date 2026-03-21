---
phase: 02-spatial-awareness-architecture
plan: 02
subsystem: agent
tags: [llm, prompt-engineering, spatial-awareness, gameplay]

# Dependency graph
requires:
  - phase: 01-paper-server-plugin-stack
    provides: Timber and AutoPickup plugins for surface-first gameplay
provides:
  - "LLM client with no artificial token limits on any call path"
  - "Surface-first gameplay instructions prioritizing look_at_block over blind mine"
  - "Clean index.js with no dead function references"
affects: [02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Surface-first block interaction: check surfaceBlocks -> look_at_block -> break_block as primary, mine as fallback"
    - "No artificial token limits on LLM calls (D-15)"

key-files:
  created: []
  modified:
    - agent/llm.js
    - agent/index.js
    - agent/prompt.js

key-decisions:
  - "Removed max_tokens entirely from text-fallback LLM path per D-15 — both branches now generate naturally"
  - "Replaced dead setNavigating(false) with stopBaritone('stuck') for consistent Baritone state management"
  - "Rewrote GAMEPLAY_INSTRUCTIONS to surface-first: surfaceBlocks + look_at_block as PRIMARY, mine as FALLBACK"

patterns-established:
  - "Surface-first interaction pattern: agents check surfaceBlocks before using blind mine search"
  - "Plugin-aware instructions: Timber (one log = whole tree) and AutoPickup (auto-collect) referenced in gameplay"

requirements-completed: [ARC-06, SAW-03, SAW-06]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 02 Plan 02: Agent Code Cleanup Summary

**Removed artificial token limits from LLM calls, fixed dead setNavigating reference, and rewrote gameplay instructions for surface-first block interaction with Timber/AutoPickup plugin awareness**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T22:02:06Z
- **Completed:** 2026-03-21T22:03:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Removed `max_tokens: MAX_TOKENS` from text-fallback LLM path -- both tool-calling and text branches now generate naturally
- Replaced dead `setNavigating(false)` call with `stopBaritone('stuck')` in index.js stuck recovery block
- Rewrote GAMEPLAY_INSTRUCTIONS to prioritize surfaceBlocks + look_at_block as primary interaction, mine as fallback
- Added Timber plugin (one log = whole tree) and AutoPickup (auto-collect) guidance to instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove MAX_TOKENS from llm.js text-fallback path** - `b550fa4` (fix)
2. **Task 2: Fix dead references in index.js and update prompt.js gameplay instructions** - `a9c89c4` (feat)

## Files Created/Modified
- `agent/llm.js` - Removed max_tokens parameter from text-fallback branch of client.chat.completions.create()
- `agent/index.js` - Replaced dead setNavigating(false) with stopBaritone('stuck') on line 811
- `agent/prompt.js` - Rewrote GAMEPLAY_INSTRUCTIONS constant for surface-first spatial awareness

## Decisions Made
- Removed max_tokens entirely rather than setting a high default -- per D-15, no artificial limits
- Used stopBaritone('stuck') for consistency with existing stuck recovery pattern on line 579
- Kept DEFAULT_IDENTITY unchanged -- meta-game prohibition already present per D-20/D-21

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- llm.js, index.js, and prompt.js are clean prerequisite for Plan 03 (decision tree integration)
- surfaceBlocks instructions ready -- agents will use look_at_block as primary interaction once surfaceBlocks data is available from mod
- All three files syntactically valid ESM (verified with node --check)

## Self-Check: PASSED

All files exist, all commits verified, all content checks pass.

---
*Phase: 02-spatial-awareness-architecture*
*Completed: 2026-03-21*
