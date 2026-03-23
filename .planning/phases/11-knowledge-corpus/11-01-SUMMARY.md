---
phase: 11-knowledge-corpus
plan: "01"
subsystem: knowledge
tags: [minecraft-data, recipe-chain, rag, corpus, knowledge-base]

# Dependency graph
requires: []
provides:
  - "mind/knowledge.js module with initKnowledge, loadKnowledge, getAllChunks, buildRecipeChunks"
  - "Recipe chain resolver producing 782 chunks with full raw-material dependency chains"
  - "SMELT_FROM hardcoded table covering 20 smelting pairs missing from minecraft-data"
  - "Cycle detection via visited-set DFS preventing iron_ingot <-> iron_nugget infinite loops"
affects:
  - "11-knowledge-corpus/11-02 (fact chunk generators will extend this module)"
  - "11-knowledge-corpus/11-03 (strategy/command chunks will extend loadKnowledge)"
  - "12-indexing (imports getAllChunks for embedding)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Corpus builder module follows memory.js init pattern: initKnowledge(config), loadKnowledge(), getAllChunks()"
    - "SMELT_FROM hardcoded table as authoritative smelting data source (minecraft-data has no furnace data)"
    - "DFS recipe resolver passes new Set(visited) to sub-calls — sibling ingredients never block each other"
    - "Recipe tiebreak: prefer oak_* for wood variants, cobblestone for stone variants"

key-files:
  created:
    - mind/knowledge.js
    - agent/tests/knowledge.test.js
  modified: []

key-decisions:
  - "Hardcode SMELT_FROM table (20 pairs) in mind/knowledge.js — minecraft-data v3.105.0 has no furnace recipe data for 1.21.1"
  - "Pass new Set(visited) to each recursive sub-call so sibling ingredients do not falsely block each other"
  - "Recipe tiebreak: prefer preferred ingredients (oak_planks, oak_log, cobblestone) to produce human-readable common-case chains"
  - "Cap chunk text at 600 chars to fit embedding model 256-token window in Phase 12"
  - "Export buildRecipeChunks as named export so Plan 03 and tests can call it directly"

patterns-established:
  - "knowledge.js init pattern: initKnowledge(config) sets KNOWLEDGE_DIR, loadKnowledge() builds chunks synchronously"
  - "Chunk schema: { id: string, text: string, type: string, tags: string[], source: string }"
  - "Chunk id format: {type}_{name} — e.g. recipe_iron_pickaxe, mob_creeper"
  - "TDD test file at agent/tests/knowledge.test.js using Node.js built-in test runner (node --test)"

requirements-completed: [RAG-01]

# Metrics
duration: 2min
completed: "2026-03-23"
---

# Phase 11 Plan 01: Knowledge Corpus — Recipe Chain Resolver Summary

**Recursive recipe chain resolver in mind/knowledge.js produces 782 chunks resolving every craftable MC 1.21.1 item to raw materials via hardcoded smelting table and cycle-safe DFS**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T03:13:07Z
- **Completed:** 2026-03-23T03:15:02Z
- **Tasks:** 1 (TDD: test + feat)
- **Files modified:** 2

## Accomplishments

- Created `mind/knowledge.js` with all 4 required exports and SMELT_FROM table
- Recipe chain resolver correctly shows iron_pickaxe as "smelt raw_iron" not "craft from nuggets"
- Cycle detection prevents infinite recursion on iron_ingot <-> iron_nugget circular recipes
- 782 recipe chunks generated (100% of minecraft-data recipe items), all with correct schema
- All 9 TDD tests pass in Node.js built-in test runner

## Task Commits

Each task was committed atomically:

1. **TDD RED — Failing tests for knowledge.js** - `ec95c03` (test)
2. **TDD GREEN — mind/knowledge.js implementation** - `455fd6e` (feat)

_Note: TDD task has two commits: test (RED) then implementation (GREEN)_

## Files Created/Modified

- `mind/knowledge.js` — Corpus builder module with recipe chain resolver, SMELT_FROM table, initKnowledge/loadKnowledge/getAllChunks/buildRecipeChunks exports
- `agent/tests/knowledge.test.js` — 9 TDD tests covering init, schema shape, smelting path, chunk count, and no-empty-text invariants

## Decisions Made

- **SMELT_FROM hardcoded table:** minecraft-data v3.105.0 has no furnace recipe data for 1.21.1 (`data/pc/1.21.1/` has no smelting.json). Hardcoding 20 smelting pairs is the right approach — comprehensive for all gameplay-relevant metals/cooked foods.
- **Sibling-safe visited set:** Each recursive sub-call receives `new Set(visited)` (a copy), not the shared set. This prevents a sibling ingredient from appearing as "cycle" just because another sibling resolved it first.
- **Recipe tiebreak — preferred materials:** minecraft-data returns `cobbled_deepslate` first for furnace (3 variants with same ingredient count). Added PREFERRED_INGREDIENTS tiebreak to prefer `cobblestone` over `cobbled_deepslate` and `blackstone`, and `oak_*` for wood items.
- **600-char text cap:** Phase 12 embedding model has 256-token window (~1024 chars). Capping at 600 provides headroom while preserving full first-level chain + sub-chains.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recipe tiebreak needed cobblestone preference**
- **Found during:** Task 1 (TDD GREEN — running tests)
- **Issue:** Test 9 required furnace chunk to contain "cobblestone". minecraft-data returns cobbled_deepslate as first variant. The `prefer oak` tiebreak did not handle stone-type variants.
- **Fix:** Expanded PREFERRED_INGREDIENTS tiebreak list to include `cobblestone`, giving it preference over cobbled_deepslate and blackstone
- **Files modified:** mind/knowledge.js
- **Verification:** `node --test agent/tests/knowledge.test.js` passes all 9 tests
- **Committed in:** 455fd6e (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in tiebreak logic)
**Impact on plan:** Fix was necessary for test 9 correctness. No scope creep.

## Issues Encountered

- minecraft-data returns furnace recipes in order: cobbled_deepslate, blackstone, cobblestone — not the most common material first. Required tiebreak logic to prefer cobblestone as the canonical stone material.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `mind/knowledge.js` scaffold is in place; Plans 02 and 03 can extend `loadKnowledge()` with `buildFactChunks()`, `buildStrategyChunks()`, `buildCommandChunks()`
- `getAllChunks()` ready for Phase 12 indexer to consume
- Test file established — future plans should add tests to `agent/tests/knowledge.test.js`

---
*Phase: 11-knowledge-corpus*
*Completed: 2026-03-23*
