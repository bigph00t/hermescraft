---
phase: 20-gameplay-loops
plan: 02
subsystem: gameplay
tags: [prompt, knowledge, rag, progression, farming, hunting, exploration, trading, enchanting, nether, storage]

# Dependency graph
requires:
  - phase: 20-gameplay-loops-01
    provides: harvest/hunt/explore skills, 27 registry commands, EVT_MAP wiring
  - phase: 11-knowledge-corpus
    provides: buildStrategyChunks() auto-discovery of knowledge/*.md files
provides:
  - knowledge/gameplay-loops.md: 23 strategy chunks for RAG retrieval across all gameplay loops
  - buildProgressionHint: dynamic gear tier detection injected into every system prompt tick
  - FARMING/HUNTING/PROGRESSION/TRADING/STORAGE prompt sections in buildSystemPrompt Part 2
  - !harvest, !hunt, !explore in command reference and examples
  - buildUserMessage result extras: harvested, replanted, discoveries, target, searched
  - Section 26 smoke tests validating all Phase 20 artifacts
affects: [mind-prompt, knowledge-rag, smoke-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildProgressionHint: pure inventory inspection, zero LLM cost, injected per tick via template literal"
    - "knowledge/*.md auto-discovery: new files auto-indexed by buildStrategyChunks without code changes"
    - "Gameplay sections in Part 2: FARMING/HUNTING/PROGRESSION/TRADING/STORAGE always-present compact hints"

key-files:
  created:
    - knowledge/gameplay-loops.md
  modified:
    - mind/prompt.js
    - tests/smoke.test.js

key-decisions:
  - "buildProgressionHint placed before buildSystemPrompt so it can be called inside Part 2 template literal"
  - "Gameplay sections go in Part 2 after BUILDING — always-present compact hints, not RAG-dependent"
  - "PROGRESSION section uses template literal ${buildProgressionHint(bot)} for zero-overhead per-tick update"
  - "Section 26 assertions moved to after _here definition (Section 13) due to top-level ESM execution order"
  - "existsSync imported as _existsSync alias to match existing _readFileSync pattern in smoke tests"

patterns-established:
  - "Inline template literal dynamic section: ${fn(bot)} inside Part 2 backtick string avoids extra conditional"
  - "Source-level prompt assertions grouped after _here is available, not inline with prompt construction tests"

requirements-completed: [GPL-01, GPL-02, GPL-03, GPL-04, GPL-05, GPL-06, GPL-07, GPL-08, GPL-09, GPL-10]

# Metrics
duration: 12min
completed: 2026-03-23
---

# Phase 20 Plan 02: Gameplay Loops — Knowledge Corpus, Prompt Sections, Progression Hint Summary

**23-section gameplay RAG corpus, 5 always-present prompt sections (FARMING/HUNTING/PROGRESSION/TRADING/STORAGE), dynamic gear-tier progression hint, and 36 new smoke test assertions covering all Phase 20 artifacts**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-23T22:40:00Z
- **Completed:** 2026-03-23T22:52:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `knowledge/gameplay-loops.md`: 23 strategy sections, 205 lines covering all 10 GPL requirements — animal farming, crop farming, mob hunting, exploration, village discovery, villager trading, smelting, enchanting, nether survival, storage organization, tool/armor progression, daily activity loop
- `buildProgressionHint(bot)`: pure inventory inspection function detecting 6 gear tiers (none/wood/stone/iron/diamond/netherite) and returning compact upgrade guidance — injected dynamically into every system prompt tick via template literal at zero LLM cost
- `buildSystemPrompt` Part 2 extended with 5 compact gameplay sections: FARMING (farm/harvest/breed commands), HUNTING (!hunt with 48b range vs !combat 16b), PROGRESSION (dynamic tier hint), TRADING (villager profession guide), STORAGE (deposit/withdraw workflow)
- Command reference and examples updated: !harvest, !hunt, !explore, !breed added to Part 6 and Part 7
- `buildUserMessage` result extras: harvested, replanted, discoveries, target, searched fields handled
- Section 26 smoke tests: 36 new assertions covering all Phase 20 artifacts — skills, registry, RAG routing, EVT_MAP, knowledge corpus content, progression hint logic, prompt sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Create gameplay strategy knowledge corpus** - `310c89e` (feat)
2. **Task 2: Add gameplay prompt sections, progression hint, and command docs** - `949ad73` (feat)
3. **Task 3: Update smoke tests for all Phase 20 additions** - `c997949` (test)

## Files Created/Modified

- `knowledge/gameplay-loops.md` - 23 strategy RAG chunks covering all gameplay loops; auto-discovered by buildStrategyChunks()
- `mind/prompt.js` - buildProgressionHint export, 5 new Part 2 gameplay sections, !harvest/!hunt/!explore in command ref + examples, result extras
- `tests/smoke.test.js` - Section 26 with 36 assertions, existsSync import, prompt section assertions in Section 13 area

## Decisions Made

- `buildProgressionHint` placed before `buildSystemPrompt` in the file so it can be called inside the template literal; exported for external test use
- Gameplay sections placed in Part 2 (grounding) not as RAG context — they're always-present compact hints that complement RAG, not replace it
- `${buildProgressionHint(bot)}` as inline template expression means zero conditional overhead — PROGRESSION section always present, content updates per tick
- Section 26 test assertions moved to after `_here` is defined (Section 13 area) due to top-level ESM execution order — `_here` is initialized at line ~399, Section 3 checks at line ~199 would throw ReferenceError

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved Section 3 prompt assertions to after _here definition**
- **Found during:** Task 3 (smoke test implementation)
- **Issue:** Plan instructed adding `_promptSrcP20 = _readFileSync(_join(_here, ...))` in Section 3 (line ~199) but `_here` is not defined until Section 13 (line ~399) — throws `ReferenceError: Cannot access '_here' before initialization`
- **Fix:** Added prompt section assertions in Section 13 (after `_here` is defined) instead of Section 3, and removed them from Section 3 position
- **Files modified:** tests/smoke.test.js
- **Verification:** `node tests/smoke.test.js` → 513 passed, 0 failed
- **Committed in:** c997949 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking execution order issue)
**Impact on plan:** Required fix for test file to run. No scope creep — all intended assertions present, just positioned correctly.

## Issues Encountered

- None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 10 GPL requirements complete (GPL-01 through GPL-10)
- Phase 20 fully closed: 477 → 513 smoke tests passing (36 new)
- gameplay-loops.md will be auto-indexed by buildStrategyChunks() on next knowledge load — agents will have gameplay strategy RAG available
- System prompt now guides agents through all major gameplay loops with compact, always-present hints
- Gear progression is dynamically updated every tick — agents know exactly what to do next based on current inventory

---
*Phase: 20-gameplay-loops*
*Completed: 2026-03-23*
