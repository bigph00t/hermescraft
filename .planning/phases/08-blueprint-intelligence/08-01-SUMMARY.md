---
phase: 08-blueprint-intelligence
plan: "01"
subsystem: body/blueprints
tags: [blueprints, validation, minecraft-data, tdd]
dependency_graph:
  requires: []
  provides: [body/blueprints/validate.js, 8 new blueprint JSONs]
  affects: [body/skills/build.js, mind/registry.js]
tech_stack:
  added: []
  patterns: [TDD red-green, minecraft-data block lookup, size inference from grid]
key_files:
  created:
    - body/blueprints/dock.json
    - body/blueprints/bridge.json
    - body/blueprints/storage-shed.json
    - body/blueprints/shelter.json
    - body/blueprints/garden.json
    - body/blueprints/lookout-platform.json
    - body/blueprints/staircase.json
    - body/blueprints/windmill.json
    - body/blueprints/validate.js
    - body/blueprints/validate.test.js
  modified: []
decisions:
  - "validateBlueprint infers size from grid when size field is absent — enables LLM to omit it"
  - "All errors collected before returning — callers see the full picture, not just first failure"
  - "Dots and spaces are both treated as air/skip — consistent with build.js behavior"
  - "Only preferred[0] is validated against mcData — preferred[1..n] are fallbacks, not required to exist"
metrics:
  duration: 3min
  completed: "2026-03-22"
  tasks: 2
  files: 10
requirements: [CBUILD-03, CBUILD-04]
---

# Phase 08 Plan 01: Blueprint Intelligence — Reference Library + Validator Summary

**One-liner:** 8 diverse blueprint JSONs covering dock/bridge/shelter/garden/platform/staircase/windmill plus a validateBlueprint() module with 41-assertion TDD test suite using minecraft-data block name lookup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create 8 new reference blueprints | 5d86d85 | dock.json, bridge.json, storage-shed.json, shelter.json, garden.json, lookout-platform.json, staircase.json, windmill.json |
| 2 | Create blueprint validation module (TDD) | f486137 | validate.js, validate.test.js |

## Verification Results

- `ls body/blueprints/*.json | wc -l` → **12** (4 existing + 8 new)
- `node body/blueprints/validate.test.js` → **41 passed, 0 failed**
- `typeof validateBlueprint` → **"function"**
- All 12 blueprints accepted by validator without errors

## Blueprint Coverage

| File | Pattern | Size | Layers |
|------|---------|------|--------|
| small-cabin.json | Enclosed building | 5x7 | 5 |
| watchtower.json | Tall tower | 5x5 | 8 |
| animal-pen.json | Fenced enclosure | 7x7 | 2 |
| crop-farm.json | Flat farming | 9x9 | 2 |
| dock.json | Horizontal platform over water | 3x8 | 2 |
| bridge.json | Spanning structure | 3x7 | 3 |
| storage-shed.json | Compact enclosed room | 4x4 | 4 |
| shelter.json | Minimal survival structure | 3x3 | 3 |
| garden.json | Fenced decorative area | 7x7 | 2 |
| lookout-platform.json | Elevated platform on pillars | 5x5 | 5 |
| staircase.json | Vertical access stairway | 3x6 | 4 |
| windmill.json | Multi-story round tower | 5x5 | 7 |

## Validator Checks (validate.js)

1. JSON parse — early exit with clear error on bad JSON
2. Required fields — name, palette (non-empty), layers (non-empty array)
3. Size inference — infers x/z from grid, y from layer count when size is absent
4. Palette block validation — preferred[0] checked against mcData.blocksByName for MC 1.21.1
5. Layer y ordering — ascending order enforced
6. Grid row count — must match size.z
7. Grid row length — every row must match size.x
8. Palette key presence — every non-'.'/non-' ' char must exist in palette

## Decisions Made

- **Size inference:** When the LLM omits the `size` field, the validator infers it from the first layer's grid. This makes the validator more forgiving for LLM-generated blueprints.
- **Full error collection:** All errors are gathered before returning so the LLM (and humans) see the complete set of issues, not just the first one.
- **Only preferred[0] validated:** The first preferred block must be a real MC block. Fallbacks (preferred[1+]) are not validated — they may be intentional alternatives.
- **Dot and space both = air:** Consistent with how `build.js` skips characters.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] body/blueprints/dock.json exists
- [x] body/blueprints/bridge.json exists
- [x] body/blueprints/storage-shed.json exists
- [x] body/blueprints/shelter.json exists
- [x] body/blueprints/garden.json exists
- [x] body/blueprints/lookout-platform.json exists
- [x] body/blueprints/staircase.json exists
- [x] body/blueprints/windmill.json exists
- [x] body/blueprints/validate.js exists
- [x] body/blueprints/validate.test.js exists
- [x] Commit 5d86d85 exists (Task 1)
- [x] Commit f486137 exists (Task 2)

## Self-Check: PASSED
