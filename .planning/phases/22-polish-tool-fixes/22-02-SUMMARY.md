---
phase: 22-polish-tool-fixes
plan: 02
subsystem: start.js, launch-duo.sh, tests
tags: [stability, shutdown, restart, smoke-tests]
dependency_graph:
  requires: [22-01]
  provides: [graceful-shutdown, scheduled-restart, phase-22-smoke-tests]
  affects: [start.js, launch-duo.sh, tests/smoke.test.js]
tech_stack:
  added: []
  patterns: [signal-handler, guard-flag, exit-code-convention]
key_files:
  created: []
  modified:
    - start.js
    - launch-duo.sh
    - tests/smoke.test.js
decisions:
  - Exit code 42 as scheduled restart signal — well-known convention, no conflict with system codes
  - _shuttingDown guard flag prevents double-save on paired signal delivery
  - isSkillRunning() check defers restart 30s if skill active — avoids mid-build interruption
  - Chat count reset assertion rewritten from string-absence to contract-positive check
metrics:
  duration: 240
  completed_date: "2026-03-23"
  tasks: 2
  files_modified: 3
---

# Phase 22 Plan 02: Graceful Shutdown + Scheduled Restart + Smoke Tests Summary

Crash-safe shutdown handlers, 12-hour ONNX-leak restart, and comprehensive Phase 22 smoke test coverage — agents now preserve all state on stop and auto-restart cleanly after 12 hours.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Graceful shutdown + scheduled restart | 3134d9e | start.js, launch-duo.sh |
| 2 | Smoke tests for Phase 22 changes | f65bb10 | tests/smoke.test.js |

## What Was Built

### Task 1: Graceful Shutdown + Scheduled Restart

**start.js additions (after periodic save setInterval):**

1. `gracefulShutdown(signal)` function with `_shuttingDown` guard flag — called by SIGTERM and SIGINT handlers. Saves all state (periodicSave, savePlayers, saveLocations, saveBuildHistory) then exits cleanly with code 0.

2. Scheduled restart block: reads `RESTART_INTERVAL_MS` env var (default 43200000 = 12h). After the interval, if `isSkillRunning()` is true, defers 30s to avoid mid-build interruption. Otherwise saves all state and exits with code 42.

3. Updated `uncaughtException` handler to call `try { periodicSave() } catch {}` as best-effort save on crash — does not exit (recovery behavior preserved).

**launch-duo.sh fix (both Luna and Max loops):**

Added `[ $CODE -eq 42 ] && { echo "[!] Luna/Max scheduled restart — relaunching..."; continue; }` before the crash-restart path. Exit code 42 triggers immediate `continue` with no 5s delay. Exit code 0 still breaks the loop (clean shutdown). All other codes still get the 5s delay.

### Task 2: Smoke Test Coverage

Added 3 new `section()` blocks with 18 assertions covering all Phase 22 changes:

- **Phase 22 — Tool Auto-Equip Fix**: imports `body/tools.js`, tests `canHarvestWith` with 5 contract scenarios (no harvestTools, bare hands, correct tool, wrong tool). Source-level validates gather.js uses `requireHarvest: true` and imports from tools.js. Validates mine.js uses shared function (not inline).

- **Phase 22 — Stability & Shutdown**: validates start.js has SIGTERM, SIGINT, `_shuttingDown`, `process.exit(42)`, `RESTART_INTERVAL_MS`, `isSkillRunning()` check, and `periodicSave()` in uncaughtException. Validates launch-duo.sh has `CODE -eq 42`.

- **Phase 22 — Chat Count Fix**: validates mind/index.js resets `_consecutiveChatCount` based on `result.command !== 'idle'` (command-based reset, not gated on `skillResult.success`).

Also updated the Phase 21 assertion label from `'non-idle success'` to `'non-idle dispatch'` to accurately reflect the reset logic.

**Result: 573 tests pass, 0 failures.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chat count assertion was overly broad**
- **Found during:** Task 2 verification
- **Issue:** The plan's assertion `!_indexSrc22.includes('skillResult.success')` would fail because `skillResult.success` is used legitimately in 5 places in mind/index.js for logging, event tracking, and build completion detection — none related to the chat count reset. The assertion was intended to verify command-based (not success-based) reset, but tested for string absence across the whole file.
- **Fix:** Rewrote the assertion as a positive contract check: `_indexSrc22.includes("result.command !== 'idle'") && _indexSrc22.includes('_consecutiveChatCount = 0')` — this accurately verifies the reset is command-driven.
- **Files modified:** tests/smoke.test.js
- **Commit:** f65bb10

## Self-Check: PASSED

- start.js contains SIGTERM, SIGINT, _shuttingDown, process.exit(42), RESTART_INTERVAL_MS — FOUND
- launch-duo.sh contains CODE -eq 42 twice (Luna + Max) — FOUND
- tests/smoke.test.js has 3 Phase 22 section() calls — FOUND
- 573 smoke tests pass, 0 failures — VERIFIED
