---
phase: 01-paper-server-plugin-stack
plan: 02
subsystem: infra
tags: [paper, plugins, luckperms, essentialsx, vault, veinminer, timber, chunky, autopickup]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Paper 1.21.1 server running in Docker on Glass"
provides:
  - "Timber tree-felling plugin installed and enabled"
  - "VeinMiner ore vein mining plugin installed and enabled"
  - "AutoPickup (JAutoPickup) item auto-collection plugin installed and enabled"
  - "EssentialsX economy and utility commands installed and enabled"
  - "Vault economy API bridge installed and enabled"
  - "LuckPerms permission system with YAML storage and bot group"
  - "Chunky world pre-generation tool installed and enabled"
affects: [01-03, 01-04, 02-mod-agent-rework]

# Tech tracking
tech-stack:
  added: [Timber 1.8.2, VeinMiner 2.3.1, JAutoPickup 1.3, EssentialsX 2.21.2, Vault 1.7.3, LuckPerms 5.5.38, Chunky 1.4.40]
  patterns: [Hangar API for plugin downloads with Modrinth CDN fallback, LuckPerms YAML storage for file-based group management, ServerTap REST API for console command execution]

key-files:
  created:
    - "/opt/hermescraft/server/plugins/Timber.jar"
    - "/opt/hermescraft/server/plugins/VeinMiner.jar"
    - "/opt/hermescraft/server/plugins/AutoPickup.jar"
    - "/opt/hermescraft/server/plugins/EssentialsX.jar"
    - "/opt/hermescraft/server/plugins/Vault.jar"
    - "/opt/hermescraft/server/plugins/LuckPerms.jar"
    - "/opt/hermescraft/server/plugins/Chunky.jar"
    - "/opt/hermescraft/server/plugins/LuckPerms/yaml-storage/groups/bot.yml"
  modified:
    - "/opt/hermescraft/server/plugins/LuckPerms/config.yml"
    - "/opt/hermescraft/server/plugins/Essentials/config.yml"

key-decisions:
  - "Used TreeTimber from Modrinth CDN instead of Hangar API (Hangar download endpoint returns HTML redirects)"
  - "Used JAutoPickup from Hangar CDN instead of original AutoPickup (external-only Spigot download)"
  - "Switched LuckPerms from H2 to YAML storage for file-based group management"
  - "Used ServerTap REST API for console command execution (rcon-cli not available in container)"

patterns-established:
  - "Hangar API download: check version details for externalUrl vs downloadUrl before downloading"
  - "LuckPerms YAML group files: simple name + permissions list format"
  - "ServerTap command execution: POST to /v1/server/exec with key header and form-encoded command"

requirements-completed: [PLG-01, PLG-02, PLG-03, PLG-04, PLG-07, PLG-12]

# Metrics
duration: 12min
completed: 2026-03-21
---

# Phase 01 Plan 02: Plugin Installation Wave 1 Summary

**7 Paper plugins (Timber, VeinMiner, AutoPickup, EssentialsX+Vault, LuckPerms, Chunky) installed with LuckPerms bot group and EssentialsX economy configured**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-21T20:51:02Z
- **Completed:** 2026-03-21T21:03:34Z
- **Tasks:** 2
- **Files modified:** 10 (7 plugin jars + 1 group file + 2 config files, all on remote server)

## Accomplishments
- Downloaded and installed 7 plugin jars (Timber, VeinMiner, AutoPickup, EssentialsX, Vault, LuckPerms, Chunky) on Paper server
- All 7 plugins load and enable without critical errors (confirmed via docker logs)
- LuckPerms switched to YAML storage and "bot" group created with 12 wildcard permission nodes
- EssentialsX economy configured with starting balance of 100, essential commands (home/warp/back/pay) enabled

## Task Commits

All work was performed on the remote Glass server via SSH. No local repository files were modified.

1. **Task 1: Download and install plugins** - Remote-only (7 jars downloaded, server restarted, all plugins enabling)
2. **Task 2: Configure LuckPerms bot group and EssentialsX economy** - Remote-only (YAML storage, bot.yml created, starting-balance set)

## Files Created/Modified
- `/opt/hermescraft/server/plugins/Timber.jar` - TreeTimber 1.8.2 tree-felling plugin (from Modrinth CDN)
- `/opt/hermescraft/server/plugins/VeinMiner.jar` - VeinMiner 2.3.1 ore vein mining (from GitHub)
- `/opt/hermescraft/server/plugins/AutoPickup.jar` - JAutoPickup 1.3 auto item collection (from Hangar CDN)
- `/opt/hermescraft/server/plugins/EssentialsX.jar` - EssentialsX 2.21.2 economy/utility (from GitHub)
- `/opt/hermescraft/server/plugins/Vault.jar` - Vault 1.7.3 economy API bridge (from GitHub)
- `/opt/hermescraft/server/plugins/LuckPerms.jar` - LuckPerms 5.5.38 permission system (from luckperms.net)
- `/opt/hermescraft/server/plugins/Chunky.jar` - Chunky 1.4.40 world pre-gen (from Hangar CDN)
- `/opt/hermescraft/server/plugins/LuckPerms/config.yml` - Changed storage-method from h2 to yaml
- `/opt/hermescraft/server/plugins/LuckPerms/yaml-storage/groups/bot.yml` - Bot group with wildcard permissions
- `/opt/hermescraft/server/plugins/Essentials/config.yml` - Set starting-balance to 100

## Decisions Made
- **TreeTimber from Modrinth instead of Hangar direct download:** Hangar API download endpoint for "Timber" by Imperialroma10 returns HTML (redirects to Modrinth page). The actual jar is hosted on Modrinth CDN as "TreeTimber" by the same author.
- **JAutoPickup instead of original AutoPickup:** The original AutoPickup plugin on Hangar has an external-only download link to SpigotMC (requires browser login). JAutoPickup by JadedMC has a direct CDN download and equivalent functionality.
- **LuckPerms YAML storage over H2:** H2 (default) requires console commands to manage groups. YAML storage allows direct file creation, making automation reliable without RCON.
- **ServerTap for console commands:** rcon-cli is not installed in the Docker container. ServerTap's REST API provides command execution capability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hangar API download returns HTML instead of jar**
- **Found during:** Task 1 (plugin downloads)
- **Issue:** Hangar API `/versions/{version}/PAPER/download` endpoint for Timber and AutoPickup returned HTML pages instead of jar files. These plugins have `externalUrl` set (pointing to Modrinth/SpigotMC) with no `downloadUrl`.
- **Fix:** For Timber, downloaded from Modrinth CDN (same plugin, different distribution). For AutoPickup, switched to JAutoPickup which has direct Hangar CDN download.
- **Files modified:** Timber.jar, AutoPickup.jar
- **Verification:** `file` command confirms both are valid Java archives
- **Committed in:** (remote-only, no git commit)

**2. [Rule 3 - Blocking] Corrupt mcMMO.jar blocking server startup**
- **Found during:** Task 1 (server restart)
- **Issue:** A corrupt mcMMO.jar (from plan 01-03 parallel execution) was blocking Paper's plugin remapper. It was an HTML file, not a jar.
- **Fix:** Removed the corrupt mcMMO.jar file. (Plan 01-03 will re-download it correctly.)
- **Files modified:** Removed /opt/hermescraft/server/plugins/mcMMO.jar
- **Verification:** Server starts without remapper errors
- **Committed in:** (remote-only, no git commit)

**3. [Rule 3 - Blocking] Permission denied on plugins directory**
- **Found during:** Task 1 (first download attempt)
- **Issue:** plugins/ directory owned by root, curl couldn't write jar files
- **Fix:** `sudo chown -R alex:alex /opt/hermescraft/server/plugins/`
- **Verification:** Subsequent downloads succeeded

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All fixes necessary to complete plugin installation. No scope creep. Alternative plugins (TreeTimber, JAutoPickup) provide equivalent functionality.

## Issues Encountered
- EssentialsX shows "unsupported server version" warning on Paper 1.21.1 -- this is a non-critical warning, the plugin functions normally
- VeinMiner warns about pale_oak blocks not existing -- expected on 1.21.1 (pale oak added in 1.21.2+), harmless
- Server takes ~138s to start with all 12 plugins (QuickShop-Hikari downloads Maven dependencies on first run)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 wave-1 plugins installed and operational
- LuckPerms bot group ready for player assignment
- EssentialsX economy ready with 100 starting balance
- Plan 01-03 (wave 2 plugins) can proceed independently
- Plan 01-04 (client verification) depends on all plugins being installed

## Self-Check: PASSED

- FOUND: 01-02-SUMMARY.md
- FOUND: All 7 plugin jars on Glass (/opt/hermescraft/server/plugins/)
- FOUND: LuckPerms bot group with 12 wildcard permissions
- FOUND: EssentialsX starting-balance: 100
- VERIFIED: All plugins enabling in docker logs (no critical errors)

---
*Phase: 01-paper-server-plugin-stack*
*Completed: 2026-03-21*
