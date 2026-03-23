---
phase: 16-vision-system
plan: 02
subsystem: vision-wiring
tags: [vision, minimap, vlm, see-command, prompt-injection, background-brain, post-build-scan, smoke-tests]

# Dependency graph
requires:
  - phase: 16-vision-system
    plan: 01
    provides: mind/vision.js (captureScreenshot, queryVLM, buildVisionForPrompt), mind/minimap.js (getMinimapSummary), mind/spatial.js Tier 4 entity awareness
affects: [mind/index.js, mind/registry.js, mind/prompt.js, mind/backgroundBrain.js, tests/smoke.test.js]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Consume-once pattern for _lastVisionResult and _postBuildScan (mirrors _lastDeath pattern)
    - Pre-dispatch interception in think() for async multi-step commands (!see, !design)
    - Parts 5.9/5.10/5.11 conditional prompt injection slots
    - DISPLAY env guard on periodic background vision (Xvfb required)

key-files:
  created: []
  modified:
    - mind/index.js
    - mind/registry.js
    - mind/prompt.js
    - mind/backgroundBrain.js
    - tests/smoke.test.js

key-decisions:
  - "!see handler placed before dispatch() in think(), mirroring !design pattern — avoids extra LLM call routing overhead"
  - "visionContext and minimapContext cleared after every think() call (consume-once) — prevents stale vision from persisting multiple turns"
  - "Post-build scan uses ±2/+12 bounding box (not blueprint dimensions) — simple heuristic that works for most blueprints"
  - "Background vision only fires when process.env.DISPLAY is set — safe on headless servers without Xvfb"
  - "String literal assertions for HOSTILE/animals/players prefix fixed to substring match (code uses template literals)"

requirements-completed: ["SPA-02"]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 16 Plan 02: Vision System Wiring Summary

**!see command, prompt injection slots (Parts 5.9/5.10/5.11), background brain periodic vision, post-build scan hook, and 74 new smoke test assertions**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-23T20:57:30Z
- **Completed:** 2026-03-23T21:01:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Wired !see command as pre-dispatch handler in think() with consume-once `_lastVisionResult` state (mirrors `_lastDeath` pattern)
- Added `_postBuildScan` consume-once state + SPA-02 post-build scan hook that fires after every successful `!build`
- Added imports for `captureScreenshot`, `queryVLM`, `buildVisionForPrompt`, `getMinimapSummary`, `scanArea` to mind/index.js
- Added `!see` stub to registry.js — 23 total commands
- Added Parts 5.9 (visionContext), 5.10 (minimapContext), 5.11 (postBuildScan) injection slots in prompt.js
- Added `!see` to command reference and examples in Part 6/7 of system prompt
- Added periodic vision capture to backgroundBrain.js with DISPLAY env guard and `visionNote` storage in brain-state.json
- Added `visionNote?.text` display in `formatBrainState()` with age timestamp
- Added Sections 18 and 19 to smoke.test.js (74 new assertions: 52 vision, 14 entity awareness, 8 overlap)
- Updated registry command count assertion from 22 to 23
- All 393 smoke tests pass (74 new + 319 existing)

## Task Commits

1. **Task 1: Wire !see command, prompt injection slots, and background brain vision** - `cf34bcb` (feat)
2. **Task 2: Comprehensive smoke tests for vision system (Sections 18-19)** - `f1c918a` (test)

## Files Created/Modified

- `mind/index.js` — !see pre-dispatch, _lastVisionResult/_postBuildScan states, SPA-02 scan hook, new imports
- `mind/registry.js` — !see stub entry (23 commands total)
- `mind/prompt.js` — Parts 5.9/5.10/5.11, !see in command reference + examples
- `mind/backgroundBrain.js` — captureScreenshot/queryVLM import, periodic vision in cycle, visionNote in formatBrainState
- `tests/smoke.test.js` — Sections 18 + 19, command count 22→23, expectedCmds includes 'see'

## Decisions Made

- Used pre-dispatch interception (same pattern as !design) for !see — keeps registry as pure lookup bridge
- Consume-once clears vision/scan results immediately after injection into system prompt — prevents prompt bloat
- Post-build scan bounding box: build origin ±2/+12 — covers typical blueprint footprint without requiring exact dimensions
- Background vision gated on `process.env.DISPLAY` — zero overhead on servers without Xvfb
- Fixed 3 smoke test assertions that checked for `'HOSTILE: '` single-quoted strings — code uses template literals; changed to substring match `'HOSTILE: '`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed string literal assertions for spatial.js prefix checks**
- **Found during:** Task 2 — smoke tests failing
- **Issue:** Plan specified `_spatialSrc16.includes("'HOSTILE: '")` checking for single-quoted string literal, but spatial.js uses template literals (backtick strings), so the literal `'HOSTILE: '` never appears in source
- **Fix:** Changed to `_spatialSrc16.includes('HOSTILE: ')` — substring match that works regardless of string delimiter
- **Files modified:** tests/smoke.test.js
- **Commit:** f1c918a (same commit as Section 18-19 addition)

## Known Stubs

None — all integration points are fully wired. The !see command flow from trigger → captureScreenshot → queryVLM → _lastVisionResult → prompt injection is complete. VLM being offline returns null gracefully at every step.

## Self-Check
