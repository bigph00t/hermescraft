---
phase: 01-bot-foundation-core-skills
plan: 01
subsystem: infra
tags: [mineflayer, mineflayer-pathfinder, mineflayer-tool, minecraft-data, bot, pathfinder, interrupt]

# Dependency graph
requires: []
provides:
  - body/bot.js: createBot() — offline-mode mineflayer bot with pathfinder + tool plugins on Paper 1.21.1
  - body/interrupt.js: clearInterrupt, isInterrupted, requestInterrupt — cooperative cancellation harness
  - body/normalizer.js: normalizeItemName, normalizeBlockName — LLM name canonicalization for MC 1.21.1
  - mineflayer-pathfinder@^2.4.5 and mineflayer-tool@^1.2.0 in package.json
affects: [02-navigation-and-digging, 03-skills-gather-mine, all subsequent plans in phase 01]

# Tech tracking
tech-stack:
  added: [mineflayer-pathfinder@^2.4.5, mineflayer-tool@^1.2.0]
  patterns:
    - createBot() returns Promise that resolves on spawn event with 30s timeout guard
    - Plugins loaded before spawn; Movements set inside spawn handler (world-state dependency)
    - bot.interrupt_code flag on bot object — initialized false in spawn; checked after every await in skill loops
    - Shared _normalize(name, registry) helper avoids duplicating the 9-step pipeline for items vs blocks

key-files:
  created:
    - body/bot.js
    - body/interrupt.js
    - body/normalizer.js
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Promise-based createBot with 30s spawn timeout — skills can await connection before proceeding"
  - "bot.interrupt_code lives on bot object, not in module state — supports multiple bot instances"
  - "normalizeBlockName added via shared _normalize helper — avoids duplicating the 9-step pipeline"
  - "mineflayer-pathfinder Movements set inside spawn handler per research (Pitfall 6: must be post-spawn)"

patterns-established:
  - "Pattern: cooperative interrupt — set bot.interrupt_code = true to cancel, clearInterrupt() before each skill"
  - "Pattern: plugin load order — loadPlugin() before spawn, setMovements() inside spawn handler"
  - "Pattern: normalizer pipeline — 9 steps, ALIASES first, then registry validation, prefix search fallback"

requirements-completed: [BOT-01, BOT-05]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 01 Plan 01: Bot Foundation Summary

**Headless mineflayer bot with pathfinder and tool plugins on Paper 1.21.1, cooperative interrupt harness, and item/block name normalizer — foundation for all body/ skills**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T17:21:39Z
- **Completed:** 2026-03-22T17:23:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed mineflayer-pathfinder@^2.4.5 and mineflayer-tool@^1.2.0 into package.json
- Created body/bot.js: createBot() with offline auth, Paper 1.21.1, pathfinder + tool plugins loaded pre-spawn, Movements set in spawn handler, 30s spawn timeout
- Created body/interrupt.js: clearInterrupt, isInterrupted, requestInterrupt cooperative cancellation helpers
- Created body/normalizer.js: ported from v1 agent/normalizer.js with shared _normalize helper and new normalizeBlockName() for block registry validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create bot lifecycle module** - `f4cdaa3` (feat)
2. **Task 2: Port normalizer to body/ and add block name support** - `9ac6522` (feat)

## Files Created/Modified
- `body/bot.js` - createBot() with offline-mode mineflayer bot, plugin loading, spawn lifecycle, 30s timeout
- `body/interrupt.js` - clearInterrupt, isInterrupted, requestInterrupt cooperative interrupt helpers
- `body/normalizer.js` - normalizeItemName and normalizeBlockName with shared pipeline
- `package.json` - mineflayer-pathfinder@^2.4.5 and mineflayer-tool@^1.2.0 added to dependencies
- `package-lock.json` - lockfile updated

## Decisions Made
- Promise-based createBot with 30s spawn timeout: skills can await connection cleanly; spawn_timeout error surfaces clearly
- bot.interrupt_code on bot object (not module state): supports multiple concurrent bot instances correctly
- normalizeBlockName shares _normalize helper with normalizeItemName: avoids duplicating the 9-step pipeline; ALIASES work for both since most common aliases apply to both items and blocks
- Movements set inside spawn handler per research Pitfall 6: new Movements(bot) requires initialized world state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- body/ foundation is complete: bot.js, interrupt.js, normalizer.js all verified with module imports and functional tests
- Ready for Plan 02: navigate.js (goto with wall-clock timeout) and dig.js (with post-dig verification)
- mineflayer-pathfinder live validation against Paper 1.21.1 still needed (flagged in STATE.md research flags) — Plan 02 smoke test will cover this

## Self-Check: PASSED

- body/bot.js: FOUND
- body/interrupt.js: FOUND
- body/normalizer.js: FOUND
- SUMMARY.md: FOUND
- Commit f4cdaa3: FOUND
- Commit 9ac6522: FOUND

---
*Phase: 01-bot-foundation-core-skills*
*Completed: 2026-03-22*
