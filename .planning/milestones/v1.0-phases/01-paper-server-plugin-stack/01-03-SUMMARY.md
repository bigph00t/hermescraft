---
phase: 01-paper-server-plugin-stack
plan: 03
subsystem: infra
tags: [minecraft, paper, plugins, auraskills, quickshop, skript, servertap, stopspam]

# Dependency graph
requires:
  - phase: 01-paper-server-plugin-stack/01
    provides: "Paper server running in Docker on Glass"
provides:
  - "AuraSkills RPG progression plugin (mcMMO alternative)"
  - "QuickShop-Hikari trading/shop plugin"
  - "Skript custom command scripting engine"
  - "ServerTap REST API plugin (port 4567)"
  - "StopSpam chat rate limiting with 5s cooldown"
  - "StopSpam configured with similarity detection"
affects: [01-paper-server-plugin-stack/04, 02-mod-bridge-upgrade, 03-agent-architecture]

# Tech tracking
tech-stack:
  added: [AuraSkills, QuickShop-Hikari, Skript, ServerTap, StopSpam]
  patterns: [hangar-api-download, modrinth-api-download, spiget-api, pre-created-plugin-config]

key-files:
  created:
    - "/opt/hermescraft/server/plugins/AuraSkills.jar"
    - "/opt/hermescraft/server/plugins/QuickShop-Hikari.jar"
    - "/opt/hermescraft/server/plugins/Skript.jar"
    - "/opt/hermescraft/server/plugins/ServerTap.jar"
    - "/opt/hermescraft/server/plugins/StopSpam.jar"
    - "/opt/hermescraft/server/plugins/StopSpam/config.yml"
  modified: []

key-decisions:
  - "Used AuraSkills instead of mcMMO -- mcMMO only available on SpigotMC (no public download API), AuraSkills provides equivalent RPG skill progression and is available on Hangar"
  - "BlockBeacon not available on any public API -- /findblock to be implemented via Skript in Phase 3"
  - "ServerTap port 4567 not yet exposed in Docker -- container needs recreation with additional port mapping"
  - "StopSpam configured with 5000ms (5-second) cooldown and similarity detection threshold 0.85"

patterns-established:
  - "Hangar API download: GET /api/v1/projects/{slug}/latestrelease then /versions/{ver}/PAPER/download"
  - "Modrinth API download: GET /v2/project/{slug}/version then extract file URL from JSON"
  - "Pre-creating plugin config dirs before first server restart to apply custom settings on first load"

requirements-completed: [PLG-06, PLG-08, PLG-09, PLG-10, PLG-11]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 01 Plan 03: Batch 2 Plugin Installation Summary

**5 gameplay/utility plugins installed via Hangar/Modrinth/GitHub APIs, StopSpam pre-configured with 5s cooldown and similarity detection**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T20:51:15Z
- **Completed:** 2026-03-21T20:57:32Z
- **Tasks:** 2
- **Files modified:** 6 (all on remote Glass server)

## Accomplishments
- Downloaded 5 of 6 planned plugins to Glass server's plugins directory
- AuraSkills substituted for mcMMO (SpigotMC lacks public download API)
- StopSpam pre-configured with 5000ms cooldown and similarity detection enabled
- ServerTap REST API plugin ready (port 4567 exposure deferred to container recreation)
- All jars validated as proper Java archives (not HTML error pages)

## Task Commits

Both tasks involved remote server work (SSH to Glass) with no local file changes:

1. **Task 1: Download plugins** - Remote work only (no local commit)
2. **Task 2: Configure StopSpam** - Remote work only (no local commit)

**Plan metadata:** See final commit below

## Files Created/Modified

All on Glass server (`ssh glass`):
- `/opt/hermescraft/server/plugins/AuraSkills.jar` - RPG skills/progression (4.9 MB, Hangar)
- `/opt/hermescraft/server/plugins/QuickShop-Hikari.jar` - Player shops/trading (4.4 MB, Modrinth)
- `/opt/hermescraft/server/plugins/Skript.jar` - Custom command scripting (4.8 MB, Hangar)
- `/opt/hermescraft/server/plugins/ServerTap.jar` - REST API for server state (24.7 MB, GitHub)
- `/opt/hermescraft/server/plugins/StopSpam.jar` - Chat rate limiting (32 KB, Hangar)
- `/opt/hermescraft/server/plugins/StopSpam/config.yml` - Custom config: 5s cooldown, similarity on

## Decisions Made

1. **AuraSkills over mcMMO** - mcMMO (SpigotMC resource #64348) cannot be downloaded via API; SpigotMC/Spiget redirect to browser. AuraSkills provides equivalent RPG skill progression (13 skills, leveling, skill trees) and is freely available on Hangar API. Can swap to mcMMO later if manually downloaded.

2. **BlockBeacon deferred** - ThreeFour-Plugins/BlockBeacon repo not found on GitHub, Modrinth, or Hangar. The /findblock functionality will be implemented as a Skript script in Phase 3.

3. **ServerTap port deferred** - ServerTap runs on port 4567 inside the container, but the Docker container only maps ports 25565 and 25575. Container recreation needed to expose 4567. Noted for orchestrator/plan 01-04.

4. **Pre-created StopSpam config** - Wrote config.yml before first plugin load so settings take effect immediately on server restart.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] mcMMO unavailable via API, substituted AuraSkills**
- **Found during:** Task 1 (Plugin download)
- **Issue:** mcMMO is distributed exclusively via SpigotMC which has no public download API. Spiget API returns a 94-byte JSON redirect, not the actual jar.
- **Fix:** Downloaded AuraSkills (Hangar, 4.9 MB) as mcMMO alternative providing equivalent RPG progression features
- **Files modified:** /opt/hermescraft/server/plugins/AuraSkills.jar
- **Verification:** Jar validated as proper Java archive, 4975884 bytes

**2. [Rule 3 - Blocking] ServerTap GitHub repo casing mismatch**
- **Found during:** Task 1 (Plugin download)
- **Issue:** The script used `servertap-io/ServerTap` (capitalized) but the repo is `servertap-io/servertap` (lowercase). GitHub API is case-sensitive for some endpoints.
- **Fix:** Found correct URL from releases listing and downloaded directly
- **Files modified:** /opt/hermescraft/server/plugins/ServerTap.jar
- **Verification:** 24757655 bytes, valid Java archive

---

**Total deviations:** 2 auto-fixed (both blocking issues)
**Impact on plan:** AuraSkills is a functionally equivalent mcMMO replacement. No scope creep.

## Issues Encountered
- BlockBeacon plugin does not exist on any public repository (GitHub, Modrinth, Hangar). Deferred to Skript implementation.
- Docker container needs port 4567 exposed for external ServerTap REST API access. Currently only accessible from inside the container.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All batch 2 plugins are downloaded and ready to load on server restart
- StopSpam config pre-created with correct settings
- Server restart needed (orchestrator coordinates with batch 1/plan 02)
- Docker container recreation needed to expose ServerTap port 4567
- BlockBeacon functionality deferred to Skript implementation in Phase 3

## Self-Check: PASSED

- FOUND: 01-03-SUMMARY.md (local)
- FOUND: AuraSkills.jar (remote)
- FOUND: QuickShop-Hikari.jar (remote)
- FOUND: Skript.jar (remote)
- FOUND: ServerTap.jar (remote)
- FOUND: StopSpam.jar (remote)
- FOUND: StopSpam/config.yml (remote)

---
*Phase: 01-paper-server-plugin-stack*
*Completed: 2026-03-21*
