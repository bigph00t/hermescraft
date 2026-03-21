---
phase: 02-spatial-awareness-architecture
plan: 01
subsystem: mod
tags: [java, fabric, minecraft, baritone, spatial-awareness, state-reader]

# Dependency graph
requires:
  - phase: 01-paper-server-plugin-stack
    provides: Paper server with Timber/VeinMiner/AutoPickup plugins
provides:
  - surfaceBlocks array in mod state JSON output (sky-visible resources within 24 blocks)
  - configureSettings() method for Baritone surface mining configuration
affects: [02-spatial-awareness-architecture, agent-prompt, agent-state]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isSkyVisible(pos.up()) filter for surface block detection"
    - "Baritone settings via chat commands (#settingName value)"

key-files:
  created: []
  modified:
    - mod/src/main/java/hermescraft/StateReader.java
    - mod/src/main/java/hermescraft/BaritoneIntegration.java

key-decisions:
  - "Chat command syntax #settingName value (not #set prefix) per Baritone documentation"
  - "Surface scan 24-block horizontal, -5/+10 vertical, capped at 20 results sorted by distance"

patterns-established:
  - "SURFACE_BLOCKS constant for sky-visible resource type filtering"
  - "buildSurfaceBlocks pattern: scan radius, filter by block type AND sky visibility, sort by distance, cap results"

requirements-completed: [SAW-01, SAW-04, SAW-05]

# Metrics
duration: 1min
completed: 2026-03-21
---

# Phase 02 Plan 01: Mod Surface Detection + Baritone Settings Summary

**Surface block detection via isSkyVisible filter in StateReader and Baritone minYLevelWhileMining/legitMine chat command configuration**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-21T22:01:55Z
- **Completed:** 2026-03-21T22:03:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added SURFACE_BLOCKS constant covering tree logs, crops, ores, and utility blocks for sky-visible scanning
- Built buildSurfaceBlocks() method scanning 24-block horizontal radius (-5/+10 vertical) filtered by world.isSkyVisible(pos.up())
- Integrated surfaceBlocks array into buildState() JSON output, sorted by distance, capped at 20 entries
- Added configureSettings() to BaritoneIntegration for minYLevelWhileMining=55 and legitMine=true via chat commands
- Deployed rebuilt mod jar to both local PrismLauncher instances (1.21.11 and hermescraft-1.21.1)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add surfaceBlocks to StateReader + Baritone settings to BaritoneIntegration** - `cb9fee8` (feat)
2. **Task 2: Deploy mod jar to Minecraft clients** - No commit (deployment to local Minecraft instance mods directories, not repo changes)

## Files Created/Modified
- `mod/src/main/java/hermescraft/StateReader.java` - Added SURFACE_BLOCKS constant, buildSurfaceBlocks() method, surfaceBlocks in buildState()
- `mod/src/main/java/hermescraft/BaritoneIntegration.java` - Added configureSettings() method for Baritone surface mining settings

## Decisions Made
- Used `#settingName value` syntax for Baritone chat commands (not `#set settingName value`) per the important_context correction -- Baritone intercepts these directly
- Surface scan radius of 24 blocks horizontal with -5/+10 vertical range and 20-entry cap balances useful coverage against JSON payload size

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Baritone chat command syntax**
- **Found during:** Task 1 (BaritoneIntegration.java configureSettings)
- **Issue:** Plan code used `#set minYLevelWhileMining 55` but per the important_context note, correct Baritone syntax is `#minYLevelWhileMining 55` (no #set prefix)
- **Fix:** Used `#minYLevelWhileMining 55` and `#legitMine true` instead of `#set` prefix versions
- **Files modified:** mod/src/main/java/hermescraft/BaritoneIntegration.java
- **Verification:** Mod compiles successfully
- **Committed in:** cb9fee8

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Corrected Baritone command syntax to match actual Baritone chat command interface. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- surfaceBlocks now available in /state JSON for agent consumption
- Baritone configureSettings() ready to be called from agent startup
- Ready for 02-02 (agent-side integration of surface blocks and Baritone settings)

## Self-Check: PASSED

- FOUND: mod/src/main/java/hermescraft/StateReader.java
- FOUND: mod/src/main/java/hermescraft/BaritoneIntegration.java
- FOUND: 02-01-SUMMARY.md
- FOUND: commit cb9fee8

---
*Phase: 02-spatial-awareness-architecture*
*Completed: 2026-03-21*
