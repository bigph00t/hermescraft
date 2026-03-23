---
phase: 19-enhanced-spatial-building
plan: 01
subsystem: building
tags: [buildPlanner, decomposeSections, auditMaterials, blueprints, spatial, planning]

# Dependency graph
requires:
  - phase: 16-vision-system
    provides: spatial.js entity awareness (SPA-01), minimap.js area familiarity (SPA-04)
  - phase: 18-memory-integration
    provides: backgroundBrain, memoryDB, episodic memory foundation
provides:
  - mind/buildPlanner.js with 10 exported functions for multi-section build planning
  - decomposeSections: deterministic foundation/walls/roof decomposition from spec dimensions
  - auditMaterials: inventory-vs-needed block gap analysis
  - planBuild: async LLM-driven plan generation with per-section blueprints
  - getBuildPlanForPrompt: active plan status string for prompt injection
  - buildExpectedBlockMap: coordinate-to-block Map for post-build diff verification
affects:
  - 19-enhanced-spatial-building P02 (wiring into agent loop, !plan command, !build integration)
  - future build coordination phases

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Atomic file write pattern (writeFileSync temp + renameSync) for plan JSON persistence
    - Deterministic section layout — LLM generates style/dims/materials, code handles coordinates
    - Section splitting when dimension exceeds 10 (fits 10x10x8 blueprint constraint)

key-files:
  created:
    - mind/buildPlanner.js
  modified:
    - tests/smoke.test.js

key-decisions:
  - "decomposeSections uses deterministic coordinate math — LLM never generates coordinates"
  - "Section splitting applied when maxW or maxD > 10 to fit existing blueprint constraint"
  - "auditMaterials takes inventory array (not bot object) — keeps function testable without mineflayer"
  - "Plan persistence in data/<agent>/builds/ separate from body/blueprints/ — planner owns its files"

patterns-established:
  - "Pattern: buildSpecPrompt constrains LLM to style+dimensions+materials only, no coordinate arrays"
  - "Pattern: extractJSON strips <think> tags then tries direct parse then regex fallback"
  - "Pattern: saveBuildPlan atomic write mirrors build-history.js writeFileSync+renameSync"

requirements-completed: [SPA-01, SPA-04, BLD-01, BLD-02, BLD-03]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 19 Plan 01: Enhanced Spatial Building Summary

**Build planning module with LLM-driven spec generation, deterministic section decomposition, material audit, and coordinate-to-block map for post-build verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T22:37:42Z
- **Completed:** 2026-03-23T22:39:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `mind/buildPlanner.js` with all 10 required exports (BLD-01/02/03)
- `decomposeSections()` deterministically decomposes any building spec into foundation/walls/roof sections with correct offsets and wall splitting for >10-block dimensions
- `auditMaterials()` compares needed blocks (summed across all pending section blueprints) against inventory array and reports gap + readiness flag
- `planBuild()` async pipeline: LLM spec gen → section decomposition → per-section blueprint gen/validation → atomic plan persistence
- `buildExpectedBlockMap()` generates coordinate Map for post-build diff (Plan 02 repair loop)
- `getBuildPlanForPrompt()` formats active plan + material gap string for prompt injection
- Verified SPA-01 (`buildSpatialAwareness` in spatial.js) and SPA-04 (`getMinimapSummary` in minimap.js) already present
- 18 new smoke tests added; all 452 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mind/buildPlanner.js** - `05a48e8` (feat)
2. **Task 2: Add buildPlanner smoke tests + verify SPA-01/SPA-04** - `3c04916` (test)

## Files Created/Modified

- `/home/bigphoot/Desktop/hermescraft/mind/buildPlanner.js` - 10-export build planning module (451 lines)
- `/home/bigphoot/Desktop/hermescraft/tests/smoke.test.js` - Added Sections 22, 23, 24 (46 lines appended)

## Decisions Made

- `auditMaterials` takes `inventory` as plain `[{ name, count }]` array rather than bot object — makes it testable without a live mineflayer bot and matches the "no mineflayer dependency in planners" pattern
- Section splitting threshold is 10 (matching `buildDesignPrompt`'s 10x10x8 blueprint constraint per RESEARCH.md Pattern 1)
- Wall sections use interior z range (1 to depth-2) for east/west walls to avoid corner overlap with north/south walls
- `planBuild` writes section blueprints even if validation fails, enabling partial recovery

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `mind/buildPlanner.js` fully functional and tested — ready for Plan 02 wiring
- Plan 02 will wire `initBuildPlanner` into `start.js`, add `!plan` command to registry, integrate `getBuildPlanForPrompt` into `buildSystemPrompt`, and implement the `!build` → section execution loop
- `buildExpectedBlockMap` ready for Plan 02 post-build repair loop

## Self-Check

- [x] `mind/buildPlanner.js` exists: `05a48e8`
- [x] `tests/smoke.test.js` modified: `3c04916`
- [x] All 452 smoke tests pass

---
*Phase: 19-enhanced-spatial-building*
*Completed: 2026-03-23*
