---
phase: 11-knowledge-corpus
plan: "03"
subsystem: mind/knowledge
tags: [rag, knowledge-corpus, corpus-builder, minecraft-data, smoke-tests]
dependency_graph:
  requires: ["11-01", "11-02"]
  provides: ["complete-corpus-builder", "2677-chunks", "smoke-tests-passing"]
  affects: ["mind/knowledge.js", "start.js", "tests/smoke.test.js"]
tech_stack:
  added: []
  patterns: ["minecraft-data-fact-chunks", "markdown-h2-splitter", "static-command-schemas"]
key_files:
  created: []
  modified:
    - mind/knowledge.js
    - start.js
    - tests/smoke.test.js
decisions:
  - "buildFactChunks produces 1662 chunks (blocks+items+foods+mobs+biomes) — items-only filter avoids block duplication"
  - "buildCommandChunks uses static COMMAND_SCHEMAS array of 22 entries (21 registry + sethome)"
  - "buildStrategyChunks splits on H2 headings, skips H1-only sections — produces 211 chunks from 10 knowledge/*.md files"
  - "loadKnowledge() logs breakdown by type at startup — corpus totals 2677 chunks"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_modified: 3
---

# Phase 11 Plan 03: Knowledge Corpus Generators + Wiring Summary

Complete corpus builder with all 4 generators producing 2,677 knowledge chunks (782 recipes, 1,662 facts, 211 strategy, 22 commands), wired into start.js startup sequence, with all smoke tests passing.

## What Was Built

### Task 1: buildFactChunks() + buildCommandChunks()

Added two exported generator functions to `mind/knowledge.js`:

**buildFactChunks() — 1,662 chunks from 5 minecraft-data sources:**
- `buildBlockChunks()` — diggable/craftable blocks filtered with gameplay significance keywords (~850 chunks)
- `buildItemChunks()` — items that are NOT blocks (avoids duplication) (~760 chunks)
- `buildFoodChunks()` — 41 food items with hunger/saturation data
- `buildMobChunks()` — hostile and passive mobs with category and size
- `buildBiomeChunks()` — all biomes with temperature, precipitation, dimension

**buildCommandChunks() — 22 chunks:**
- Static `COMMAND_SCHEMAS` array with all 21 registry commands + sethome
- Each entry: usage, purpose, args, examples, common failures
- Arg syntax matches prompt.js Part 6 exactly

All chunks conform to `{ id, text, type, tags, source }` schema with zero violations.

### Task 2: buildStrategyChunks() + Wiring + Smoke Tests

**buildStrategyChunks() — 211 chunks:**
- Reads all 10 `.md` files from `knowledge/` directory
- Splits content on H2 headings with regex `/(?=^## )/m`
- Skips H1-only title sections and heading-only sections
- Chunk IDs: `strategy_{filename}_{heading_slug}`

**loadKnowledge() updated** to call all 4 generators and log breakdown:
```
[knowledge] corpus loaded: 2677 chunks (782 recipes, 1662 facts, 211 strategy, 22 commands)
```

**start.js wired:** import + `initKnowledge(config)` + `loadKnowledge()` inserted at step 3.6 before `initMind`.

**Smoke tests:** Section 14 "Knowledge Corpus" added with 25 assertions — all pass. Full suite: 256 passed, 0 failed.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files exist:
- mind/knowledge.js — FOUND
- start.js — FOUND
- tests/smoke.test.js — FOUND
- .planning/phases/11-knowledge-corpus/11-03-SUMMARY.md — FOUND

### Commits exist:
- bff031f feat(11-03): add buildFactChunks() and buildCommandChunks()
- 31c826e feat(11-03): add buildStrategyChunks, wire start.js, add smoke tests

## Self-Check: PASSED
