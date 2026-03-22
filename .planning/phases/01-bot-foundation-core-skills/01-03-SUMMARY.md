---
phase: 01-bot-foundation-core-skills
plan: 03
subsystem: skills
tags: [mineflayer, mineflayer-tool, minecraft-data, body-layer, gather, mine, interrupt]

# Dependency graph
requires:
  - phase: 01-bot-foundation-core-skills/01-01
    provides: createBot, interrupt harness (isInterrupted), normalizeBlockName
  - phase: 01-bot-foundation-core-skills/01-02
    provides: navigateToBlock, digBlock primitives

provides:
  - gather(bot, blockName, count, options) — find+nav+dig loop with interrupt checks
  - mine(bot, oreName, count, options) — ore mining with auto-tool selection and tier enforcement

affects: [Phase 2 skills, mind layer, any skill that needs resource collection]

# Tech tracking
tech-stack:
  added: [mineflayer-tool (installed in this worktree), minecraft-data (already present)]
  patterns: [cooperative interrupt loop, find-nav-dig pattern, tool-tier enforcement]

key-files:
  created:
    - body/skills/gather.js
    - body/skills/mine.js
  modified: []

key-decisions:
  - "gather uses bot.tool.equipForBlock without requireHarvest — allows gathering any block regardless of tool tier (wood/dirt/gravel don't need specific tools)"
  - "mine uses bot.tool.equipForBlock with requireHarvest: true then validates with canHarvestWith() — hard stop on no_suitable_tool instead of wasting dig attempts"
  - "Both skills use bot.findBlocks with count:10 per outer-loop iteration — batch candidates to minimize redundant searches, break inner loop on first successful dig"
  - "Inner loop gotOne flag tracks whether batch produced a successful dig — outer loop breaks when entire batch is exhausted without success"

patterns-established:
  - "Pattern: Cooperative interrupt — isInterrupted(bot) before every await in skill loops; check before work, after equip, after nav, after dig"
  - "Pattern: Candidate batching — bot.findBlocks(count:10), inner for-loop tries each; avoids calling findBlocks again on each attempt"
  - "Pattern: Stale block re-fetch — always bot.blockAt(candidates[i]) again after navigating; bot may have moved stale block data"
  - "Pattern: Skip not fail — unreachable blocks (nav.success===false) get continue not return; skill degrades gracefully"

requirements-completed: [SKILL-01, SKILL-02]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 1 Plan 3: Gather and Mine Skills Summary

**gather() and mine() body-layer skills: interrupt-safe resource collection and ore mining with auto-tool tier enforcement**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T~17:35:00Z
- **Completed:** 2026-03-22T~17:43:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `gather(bot, blockName, count)` — find nearest blocks via `bot.findBlocks`, navigate with `navigateToBlock`, dig with `digBlock`, interrupt-safe throughout, skips unreachable blocks
- `mine(bot, oreName, count)` — same loop structure as gather but adds `requireHarvest: true` tool equip and `canHarvestWith()` check; returns `no_suitable_tool` early if tool tier is insufficient
- Both skills follow the Body layer pattern: use only primitives from Plan 02, never raw mineflayer API
- Both skills normalize block/ore names via `normalizeBlockName` before any registry lookup

## Task Commits

1. **Task 1: Create gather skill** - `5fb1cf7` (feat)
2. **Task 2: Create mine skill with auto-tool selection** - `7392337` (feat)

## Files Created/Modified

- `body/skills/gather.js` — Gather N of a resource (find+navigate+dig loop with interrupt checks)
- `body/skills/mine.js` — Mine ore blocks with auto-best-tool selection and tier enforcement

## Decisions Made

- `gather` does not enforce tool tier — blocks like oak_log, dirt, gravel have no `harvestTools` restriction, so any tool or bare hands works. Enforcing tier would be wrong here.
- `mine` enforces tier via `canHarvestWith(target, heldType)` after equip — ore mining without the correct pickaxe tier produces no drop, so it's a hard stop not a skip.
- The `canHarvestWith` check happens on the first candidate, not per-candidate — if the bot lacks a suitable tool for the ore type, no candidate in range will be minable either. Early return avoids spinning through all candidates uselessly.
- Both skills use `count: 10` in `bot.findBlocks` — gives a batch to work from without loading the world. After inner loop exhausts the batch, outer loop calls `findBlocks` again to catch freshly loaded chunks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed mineflayer-pathfinder and mineflayer-tool**
- **Found during:** Task 1 verification
- **Issue:** `mineflayer-pathfinder` and `mineflayer-tool` were not in this worktree's node_modules (they had been installed in sibling worktrees during Plans 01-01 and 01-02 but not merged/installed here)
- **Fix:** `npm install mineflayer-pathfinder mineflayer-tool` in this worktree
- **Files modified:** package-lock.json (node_modules updated)
- **Verification:** `node --input-type=module` import of gather.js resolved without error
- **Committed in:** 5fb1cf7 (included with Task 1 commit via package-lock changes)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing dependencies)
**Impact on plan:** Essential fix — both skills would have failed to import without it. No scope creep.

## Issues Encountered

- Worktree was on old `master` branch without `body/` files — resolved by merging `master` into the worktree branch before execution.

## Next Phase Readiness

- `gather` and `mine` are the first complete Body-layer skills — they demonstrate the full find+nav+dig pattern with interrupt safety
- Phase 2 can use these directly for resource gathering
- The `canHarvestWith` helper in mine.js is a standalone utility that could be extracted if needed by other skills

---
*Phase: 01-bot-foundation-core-skills*
*Completed: 2026-03-22*
