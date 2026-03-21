---
phase: 01-paper-server-plugin-stack
plan: 01
subsystem: infra
tags: [paper, minecraft, docker, server-migration, world-migration]

# Dependency graph
requires: []
provides:
  - Paper 1.21.1 server running in Docker on Glass
  - Migrated Survival Island world with correct Paper dimension layout
  - RCON enabled on port 25575
  - Both Fabric clients verified connected
affects: [01-02-PLAN, 01-03-PLAN, 01-04-PLAN]

# Tech tracking
tech-stack:
  added: [Paper 1.21.1 build 133, RCON]
  patterns: [Paper dimension directory layout, Docker server management]

key-files:
  created:
    - /opt/hermescraft/server/paper-1.21.1.jar
    - /opt/hermescraft/server/hermescraft-world_nether/
    - /opt/hermescraft/server/hermescraft-world_the_end/
  modified:
    - /opt/hermescraft/server/server.properties
    - /opt/hermescraft/server/eula.txt

key-decisions:
  - "Paper 1.21.1 build #133 selected as server platform"
  - "RCON enabled on port 25575 for remote server management"
  - "enforce-secure-profile=false required for offline-mode bot connections"
  - "Difficulty set via RCON after Paper regenerated server.properties"

patterns-established:
  - "Paper dimension layout: world_nether/DIM-1/region/, world_the_end/DIM1/region/"
  - "Docker server pattern: eclipse-temurin:21-jre with -Xmx3G -Xms2G"
  - "RCON for runtime server configuration changes"

requirements-completed: [SRV-01, SRV-02, SRV-03]

# Metrics
duration: ~30min
completed: 2026-03-21
---

# Phase 1 Plan 01: Paper Server Setup Summary

**Paper 1.21.1 (build #133) replacing Fabric server in Docker on Glass, Survival Island world migrated with Nether/End directory reorganization, both Fabric clients verified connected**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-21T20:14:00Z
- **Completed:** 2026-03-21T20:47:00Z
- **Tasks:** 2
- **Files modified:** 5 (remote server files on Glass)

## Accomplishments
- Paper 1.21.1 (build #133) installed in Docker, replacing the vanilla Fabric server
- Survival Island world migrated with Nether/End directory reorganization to Paper's split-dimension layout
- Both Fabric clients (HermesBridge + Baritone) verified connected to Paper server
- RCON enabled on port 25575 for remote server management
- World backup created before migration

## Task Commits

This plan executed infrastructure changes on the remote Glass server (SSH commands). No local repository code changes were made, so there are no task-level git commits.

1. **Task 1: Stop Fabric server, download Paper jar, migrate world directories** - remote execution (infra)
2. **Task 2: Verify Fabric clients connect to Paper server** - checkpoint:human-verify (approved)

## Files Created/Modified
- `/opt/hermescraft/server/paper-1.21.1.jar` - Paper 1.21.1 build #133 server jar
- `/opt/hermescraft/server/hermescraft-world/` - Overworld data (unchanged)
- `/opt/hermescraft/server/hermescraft-world_nether/DIM-1/region/` - Nether data (reorganized for Paper)
- `/opt/hermescraft/server/hermescraft-world_the_end/DIM1/region/` - End data (reorganized for Paper)
- `/opt/hermescraft/server/server.properties` - Updated for Paper (peaceful, survival, RCON enabled)
- `/opt/hermescraft/server/eula.txt` - EULA accepted

## Decisions Made
- Paper 1.21.1 build #133 chosen (latest stable build for MC 1.21.1)
- RCON enabled on port 25575 for runtime configuration (needed to set difficulty after Paper regenerated server.properties)
- enforce-secure-profile set to false (required for offline-mode bot connections)
- Client restart scripts created for reconnecting after server restarts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] enforce-secure-profile fix**
- **Found during:** Task 1 (server startup)
- **Issue:** Paper enforces secure profiles by default, preventing offline-mode bot clients from connecting
- **Fix:** Set enforce-secure-profile=false in server.properties
- **Files modified:** /opt/hermescraft/server/server.properties
- **Verification:** Both clients connected successfully after fix

**2. [Rule 3 - Blocking] Difficulty set via RCON**
- **Found during:** Task 1 (server configuration)
- **Issue:** Paper regenerated server.properties on first run, overwriting difficulty=peaceful setting
- **Fix:** Used RCON on port 25575 to set difficulty to peaceful at runtime, then enabled RCON permanently in server.properties
- **Files modified:** /opt/hermescraft/server/server.properties
- **Verification:** Server confirmed running in peaceful mode

**3. [Rule 2 - Missing Critical] Client restart scripts created**
- **Found during:** Task 2 (client connectivity verification)
- **Issue:** Clients needed convenient restart mechanism for reconnecting after server changes
- **Fix:** Created client restart scripts for streamlined reconnection
- **Verification:** Both clients reconnected successfully using scripts

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All fixes were necessary for server operation and client connectivity. No scope creep.

## Issues Encountered
- Paper regenerates server.properties on first startup, requiring RCON as a secondary configuration mechanism
- Secure profile enforcement needed to be disabled for offline-mode bot access

## User Setup Required

None - all server configuration handled during execution.

## Next Phase Readiness
- Paper server is running and accepting connections, ready for plugin installation (Plan 01-02)
- RCON available for runtime configuration of plugins
- Both Fabric clients confirmed working with Paper, ensuring HermesBridge + Baritone compatibility

---
*Phase: 01-paper-server-plugin-stack*
*Completed: 2026-03-21*
