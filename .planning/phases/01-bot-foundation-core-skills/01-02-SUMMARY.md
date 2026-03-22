---
phase: 01-bot-foundation-core-skills
plan: 02
subsystem: infra
tags: [mineflayer, mineflayer-pathfinder, vec3, navigation, pathfinder, dig, place, primitives]

# Dependency graph
requires:
  - phase: 01-bot-foundation-core-skills plan 01
    provides: body/bot.js createBot with pathfinder loaded; body/interrupt.js interrupt flag helpers

provides:
  - body/navigate.js — navigateTo() with wall-clock timeout; navigateToBlock() convenience
  - body/dig.js — digBlock() with post-dig block state verification
  - body/place.js — placeBlock() with post-place block state verification; FACE constants

affects:
  - all body/skills/* — these three primitives are the foundation of every skill

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.race with wall-clock setTimeout reject guards against pathfinder Issue #222 hang"
    - "clearTimeout(timerId) after every Promise.race to prevent lingering timers"
    - "bot.pathfinder.setGoal(null) for immediate halt (not .stop())"
    - "block.position.clone() before dig to save stable position reference"
    - "bot.blockAt(pos) post-dig/place check detects silent server-side protection failures"
    - "mineflayer-pathfinder is CJS — import via default then destructure: import mpf from 'mineflayer-pathfinder'; const { goals } = mpf"
    - "All primitives return { success, reason } structs; never throw to caller"

key-files:
  created:
    - body/navigate.js
    - body/dig.js
    - body/place.js
  modified: []

key-decisions:
  - "CJS import for mineflayer-pathfinder: import mpf from 'mineflayer-pathfinder'; const { goals } = mpf — named import fails in Node 24 ESM"
  - "timerId pattern in navigateTo: clearTimeout called in both success and error paths to prevent timer leaks"
  - "placeBlockOnTop uses new Vec3(0,1,0) inline rather than FACE.TOP to avoid forward reference"

patterns-established:
  - "Pattern: nav always returns structured { success, reason } — never hangs or throws"
  - "Pattern: dig/place always verify block state changed — never trust API resolve alone"
  - "Pattern: FACE constants in place.js for standard face direction reuse across skills"

requirements-completed: [BOT-02, BOT-03, BOT-04]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 01 Plan 02: Core Action Primitives Summary

**navigate.js/dig.js/place.js — three atomic wrappers enforcing nav timeout, dig verification, and place verification as project-wide safety invariants**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T17:26:49Z
- **Completed:** 2026-03-22T17:28:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `navigateTo()` wraps `bot.pathfinder.goto()` in `Promise.race` with wall-clock timeout; `setGoal(null)` on timeout for immediate halt; timer always cleaned up with `clearTimeout`
- `digBlock()` saves position before dig, checks `bot.blockAt(pos)` after to detect silent WorldGuard/CoreProtect failures; catches `diggingAborted`; never throws
- `placeBlock()` computes target position, places, verifies non-air block appeared; `placeBlockOnTop()` and `FACE` constants for convenience

## Task Commits

1. **Task 1: Create navigate module with wall-clock timeout** - `d79410c` (feat)
2. **Task 2: Create dig and place modules with post-action verification** - `c123490` (feat)

## Files Created/Modified

- `body/navigate.js` — navigateTo() and navigateToBlock() with Promise.race + wall-clock timeout
- `body/dig.js` — digBlock() with block.position.clone() and post-dig bot.blockAt() verification
- `body/place.js` — placeBlock(), placeBlockOnTop(), and FACE direction constants

## Decisions Made

- `mineflayer-pathfinder` is a CJS module: Node 24 ESM cannot use named imports. Used `import mpf from 'mineflayer-pathfinder'; const { goals } = mpf` pattern.
- `timerId` pattern: variable declared outside the timer Promise so `clearTimeout(timerId)` is reachable in the success path as well as the error path.
- `placeBlockOnTop` uses `new Vec3(0, 1, 0)` inline to avoid forward reference to `FACE.TOP` (FACE is declared later in the module); functionally identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CJS named import fails for mineflayer-pathfinder in Node 24**
- **Found during:** Task 1 (navigate module)
- **Issue:** `import { goals } from 'mineflayer-pathfinder'` throws `SyntaxError: Named export 'goals' not found` — the package is CommonJS and Node 24 ESM won't synthesize named exports from CJS
- **Fix:** Changed to default import: `import mpf from 'mineflayer-pathfinder'; const { goals } = mpf`
- **Files modified:** body/navigate.js
- **Verification:** Module imports without error; `goals.GoalNear` constructs correctly
- **Committed in:** `d79410c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correctness. Plan specified `import { goals } from 'mineflayer-pathfinder'` which fails on Node 24. CJS default import is the correct workaround.

## Issues Encountered

None beyond the CJS import deviation documented above.

## Next Phase Readiness

- All three primitives are ready for use in skills
- `navigateToBlock(bot, block)` and `navigateTo(bot, x, y, z)` are the nav interface for gather/mine skills
- `digBlock(bot, block)` replaces bare `bot.dig(block)` everywhere
- `placeBlock(bot, refBlock, faceVector)` and `FACE` constants ready for build skills
- No blockers

---
*Phase: 01-bot-foundation-core-skills*
*Completed: 2026-03-22*
