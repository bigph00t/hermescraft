---
phase: 09-directed-building
plan: "02"
subsystem: mind
tags: [registry, prompt-engineering, scan, material-swap, directed-building, smoke-test]

requires:
  - phase: 09-01
    provides: scanArea() in body/skills/scan.js, updatePalette() in body/skills/build.js

provides:
  - "!scan registry command dispatching to scanArea with default 16x8x16 area around bot"
  - "!material registry command dispatching to updatePalette with old/new block args"
  - "14-command registry (up from 12)"
  - "Directed building guidance in system prompt Part 2"
  - "!scan and !material in system prompt Part 6 (command ref) and Part 7 (examples)"
  - "220-assertion smoke test, 0 failures"
affects: [10-any-future-phase, mind-layer-consumers]

tech-stack:
  added: []
  patterns:
    - "registry wires body skills into mind layer — scan/material follow same dispatch pattern as build/combat"
    - "prompt Part 2 carries behavioral guidance for LLM; Part 6 carries syntax; Part 7 carries examples"

key-files:
  created: []
  modified:
    - mind/registry.js
    - mind/prompt.js
    - tests/smoke.test.js

key-decisions:
  - "!scan and !material go through normal dispatch() path — no pre-dispatch handling needed (unlike !design which requires a separate LLM call)"
  - "!scan defaults to 16x8x16 box (±8 x, ±4 y, ±8 z) centered on bot when no coords given — gives useful nearby scan without args"
  - "!material accepts old/from and new/to as synonym arg names for ergonomic LLM output"
  - "Directed building guidance added to Part 2 (behavioral) not Part 6 (reference) so the LLM receives it early in context"
  - "smoke.test.js additions: designAndBuild and buildDesignPrompt export checks added alongside new command assertions"

patterns-established:
  - "Registry extension pattern: add import + Map entry — no changes needed anywhere else"
  - "System prompt guided building: Part 2 for behavior, Part 6 for syntax, Part 7 for examples"

requirements-completed: [CBUILD-01, CBUILD-02, CBUILD-05]

duration: 2min
completed: 2026-03-22
---

# Phase 09 Plan 02: Directed Building Mind Wiring Summary

**!scan and !material wired into 14-command registry; system prompt updated with directed building guidance and full syntax coverage; 220 smoke tests pass**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T21:05:55Z
- **Completed:** 2026-03-22T21:08:26Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Registry extended from 12 to 14 commands — `!scan` dispatches to `scanArea()` with bot-relative defaults, `!material` dispatches to `updatePalette()`
- System prompt updated: directed building guidance in Part 2, `!scan`/`!material` syntax in Part 6, concrete examples in Part 7
- Smoke test updated: 7 new assertions (14-command count, scan/material in registry and prompt, designAndBuild/buildDesignPrompt exports, directed building text), 220 total assertions, 0 failures
- Phase 09 requirements CBUILD-01/02/05 fulfilled: bot can respond to "build X here", "use stone instead", "scan this area"

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire !scan and !material into registry, add prompt guidance, update smoke tests** - `791dcda` (feat)

## Files Created/Modified

- `mind/registry.js` — Added `scanArea` and `updatePalette` imports; added `scan` and `material` REGISTRY entries (14 total)
- `mind/prompt.js` — Added directed building guidance to Part 2; added `!material`/`!scan` to Part 6 and Part 7
- `tests/smoke.test.js` — Updated registry count to 14; added scan/material to expectedCmds and promptCmds; added designAndBuild, buildDesignPrompt, directed guidance assertions

## Decisions Made

- `!scan` and `!material` use the standard `dispatch()` path — no pre-dispatch handling required since neither triggers a separate LLM call (unlike `!design`)
- `!scan` default area: `±8` x/z, `±4` y centered on bot — 16×8×16 = 2048 blocks, well within the 32768 limit, gives a useful local snapshot without requiring coords
- `!material` accepts `old`/`from` and `new`/`to` synonyms so the LLM can use either form naturally
- Directed building guidance placed in Part 2 (behavioral rules) rather than Part 6 (command reference) so it appears before command syntax and shapes the LLM's decision-making earlier in context

## Deviations from Plan

None — plan executed exactly as written. The plan noted mind/index.js needed no changes; this was confirmed. The smoke test additions for `designAndBuild` and `buildDesignPrompt` exports were added as bonus correctness checks (within plan scope).

## Issues Encountered

None — worktree was on a stale v1 branch and was rebased onto master before beginning. All tests passed on first run.

## Next Phase Readiness

Phase 09 (directed-building) is complete. All three requirements satisfied:
- CBUILD-01: "build a dock here" → LLM issues `!design` (guided by system prompt) → blueprint generated at bot position
- CBUILD-02: "use stone instead" → LLM issues `!material old:oak_planks new:stone` → palette updated
- CBUILD-05: "scan this area" → LLM issues `!scan` → block inventory returned

Ready to proceed to Phase 10 or any follow-on milestone work.

---
*Phase: 09-directed-building*
*Completed: 2026-03-22*
