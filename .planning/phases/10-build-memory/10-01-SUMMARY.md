---
phase: 10-build-memory
plan: "01"
subsystem: mind/build-history
tags: [build-memory, cross-session, prompt-injection, tdd]
dependency_graph:
  requires: [09-directed-building/09-02]
  provides: [build history persistence, return-and-extend prompt guidance]
  affects: [mind/index.js, mind/prompt.js, start.js]
tech_stack:
  added: []
  patterns: [memory module pattern, init/load/save/getForPrompt, periodic save]
key_files:
  created:
    - mind/build-history.js
  modified:
    - start.js
    - mind/index.js
    - mind/prompt.js
    - tests/smoke.test.js
decisions:
  - "Build history uses same init/load/save pattern as memory.js and locations.js for consistency"
  - "dimensions set to {x:0,y:0,z:0} for both build paths — name/origin/blockCount are the essential fields"
  - "Return-and-extend guidance added to Part 2 (anti-hallucination/behavior section) of system prompt"
  - "saveBuildHistory also called inside recordBuild for immediate persistence; periodic save is belt-and-suspenders"
metrics:
  duration: 8min
  completed: "2026-03-22"
  tasks: 2
  files: 5
---

# Phase 10 Plan 01: Build Memory Summary

**One-liner:** Persistent build history module with cross-session LLM recall and return-to-expand guidance via getBuildHistoryForPrompt() injected into system prompt Part 5.6.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create mind/build-history.js module (TDD) | 61b201b | mind/build-history.js, tests/smoke.test.js |
| 2 | Wire build history into init, recording, prompt, periodic save | 319c024 | start.js, mind/index.js, mind/prompt.js, tests/smoke.test.js |

## Verification Results

1. `npm test` — 227 passed, 0 failed (was 220 before this plan; +7 new assertions)
2. `grep -n 'initBuildHistory' start.js` — shows import + init call at line 12 and 34
3. `grep -n 'recordBuild' mind/index.js` — shows 2 recording sites: !design (line 120) and !build (line 150)
4. `grep -n 'buildHistory' mind/prompt.js` — shows Part 5.6 injection at lines 143-145
5. `grep -n 'Previous builds' mind/build-history.js` — shows prompt format at line 62
6. `grep -n 'return to expand' mind/prompt.js` — shows return-and-extend guidance at line 120

## Decisions Made

- **Build history module pattern:** Mirrors `mind/memory.js` and `mind/locations.js` exactly: module-level `let HISTORY_FILE` and `let history`, lightweight `initBuildHistory` (no disk read), separate `loadBuildHistory`, `saveBuildHistory` for periodic save, `recordBuild` for mutation.
- **dimensions field:** Set to `{x:0,y:0,z:0}` for both !build and !design paths. Blueprint dimensions require parsing the blueprint JSON which isn't readily available at record time. The critical recall fields are name, origin, blockCount, and date.
- **Prompt placement:** Build history goes in Part 5.6 (after buildContext, before command reference) so it's visible to the LLM alongside the current build state and available blueprints — all the building context together.
- **Return-and-extend guidance location:** Added to Part 2 (behavioral grounding section) alongside existing directed building guidance — not a separate section, consistent with how scan/design/material guidance is placed.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `mind/build-history.js` — FOUND
- Task 1 commit `61b201b` — FOUND
- Task 2 commit `319c024` — FOUND
- `npm test` — 227 passed, 0 failed
