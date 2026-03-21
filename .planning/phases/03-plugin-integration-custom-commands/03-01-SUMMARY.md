---
phase: 03-plugin-integration-custom-commands
plan: 01
subsystem: api
tags: [skript, servertap, command-parser, plugin, minecraft, paper]

# Dependency graph
requires:
  - phase: 01-paper-server-plugin-stack
    provides: Paper server with Skript, AuraSkills, ServerTap installed
  - phase: 02-spatial-awareness-architecture
    provides: recentChat in state JSON, action loop, shared state pattern

provides:
  - /scan Skript command with surface filter, 5-result cap, parseable output
  - /share-location Skript command with namespaced persistent storage and broadcast
  - /myskills Skript command with AuraSkills PAPI placeholder output
  - command-parser.js module with regex patterns for all plugin chat responses
  - servertap.js module as graceful-degradation REST client for server state

affects:
  - 03-02-PLAN — tools.js and actions.js that wrap these Skript commands
  - agent prompt updates that describe plugin capabilities

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Skript global variable namespacing by player name to prevent multi-agent collisions
    - block-above-is-air as sky-visibility proxy for surface block detection in Skript
    - Silent null-return pattern for optional external service client (servertap.js)
    - COMMAND_PATTERNS regex map with typed extractor functions (extractScanResults, extractSkillLevels)

key-files:
  created:
    - server/plugins/Skript/scripts/scan.sk
    - server/plugins/Skript/scripts/share-location.sk
    - server/plugins/Skript/scripts/myskills.sk
    - agent/command-parser.js
    - agent/servertap.js
  modified: []

key-decisions:
  - "myskills.sk uses Approach A (PlaceholderAPI PAPI) with auraskills_* placeholders — fall back to /sk top if PAPI not installed"
  - "AbortSignal.timeout uses TIMEOUT_MS constant (3000) per project SCREAMING_SNAKE_CASE convention"
  - "Skript variables namespaced as {locations::%player name%::%arg-1%::*} to prevent multi-agent collisions (Pitfall 4)"
  - "scan.sk uses stop loop (not stop) to exit early at 5 results — required by Skript 2.9 loop exit syntax"

patterns-established:
  - "Pattern 1: Skript chat output format — 'Found: <block> at <x> <y> <z> (<dist> blocks away)' is the canonical scan output format matched by command-parser.js"
  - "Pattern 2: Plugin REST client — returns null on any failure, never throws, 3s timeout, optional auth key"
  - "Pattern 3: parseRecentChat accepts {text: string} objects OR raw strings (defensive .text || msg || '' fallback)"

requirements-completed: [INT-01, INT-02, INT-07]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 03 Plan 01: Plugin Foundation — Skript Commands + Parser Modules Summary

**Three Skript server commands (/scan /share-location /myskills) plus command-parser.js regex parser and servertap.js graceful-degradation REST client**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T22:58:45Z
- **Completed:** 2026-03-21T23:01:00Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- scan.sk: surface block scanner with `block above is air` sky-visibility proxy, 5-result cap (D-01), radius capped at 100 (D-04), parseable `Found: <block> at <x> <y> <z> (<dist> blocks away)` output
- share-location.sk: coordinate broadcast + persist via Skript global variables namespaced by `{locations::%player's name%::%arg-1%::*}` preventing multi-agent collision (D-02, Pitfall 4)
- myskills.sk: AuraSkills PAPI placeholder output in parseable `Skill: N` format (D-12, D-15); falls back if PlaceholderAPI absent
- command-parser.js: COMMAND_PATTERNS map with 10 regex keys + parseRecentChat, formatPluginResponse, extractScanResults, extractSkillLevels
- servertap.js: silent-catch REST client for GET /server, /players, /economy/balance with 3s timeout and empty-string formatServerSummary when unavailable (D-25)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Skript commands on the Paper server** - `ee55c86` (feat)
2. **Task 2: Create command-parser.js and servertap.js agent modules** - `4c1f2ea` (feat)

## Files Created/Modified

- `server/plugins/Skript/scripts/scan.sk` - /scan command with surface filter, radius cap, parseable output
- `server/plugins/Skript/scripts/share-location.sk` - /share-location broadcast + namespaced Skript variable storage
- `server/plugins/Skript/scripts/myskills.sk` - /myskills with AuraSkills PAPI placeholders
- `agent/command-parser.js` - COMMAND_PATTERNS + parseRecentChat/formatPluginResponse/extractScanResults/extractSkillLevels
- `agent/servertap.js` - ServerTap REST client with graceful null-return degradation

## Decisions Made

- myskills.sk uses Approach A (PAPI placeholders) per the plan recommendation. If PlaceholderAPI is not installed on the server, the placeholders will render as literal text — in that case, switch to Approach B (proxy to `/sk top foraging` etc.).
- scan.sk uses `stop loop` (not `stop`) to exit the block-scanning loop at 5 results. This is the correct Skript 2.9 syntax for early loop exit.
- servertap.js uses a `TIMEOUT_MS = 3000` constant rather than the inline literal `3000`, following the project's SCREAMING_SNAKE_CASE convention for numeric constants.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**LuckPerms permission required for /scan command:**

Agents need `skript.scan` permission before the `/scan` command will work. Run via ServerTap REST API or RCON:

```
lp group bot permission set skript.scan true
```

**PlaceholderAPI for myskills.sk (optional but recommended):**

The `/myskills` command uses `%auraskills_*%` PAPI placeholders. If PlaceholderAPI is not installed, placeholders show as literal text. Either install PlaceholderAPI on the Paper server, or switch `myskills.sk` to Approach B (chat command proxy to `/sk top <skill>`).

**Docker deployment:**

These Skript files need to be copied to the Paper server container:

```bash
docker cp server/plugins/Skript/scripts/scan.sk minecraft-server:/data/plugins/Skript/scripts/
docker cp server/plugins/Skript/scripts/share-location.sk minecraft-server:/data/plugins/Skript/scripts/
docker cp server/plugins/Skript/scripts/myskills.sk minecraft-server:/data/plugins/Skript/scripts/
```

Then reload Skript in-game: `/sk reload all`

## Next Phase Readiness

- Plan 02 can now add `scan_blocks`, `share_location`, `check_skills` tool handlers in actions.js — these translate directly to the commands created here
- command-parser.js is ready to be imported into state.js or the action loop for Plugin Response injection
- servertap.js is ready to be called from state.js to append server TPS/player count to the state summary
- Skript command output formats are locked — regex patterns in COMMAND_PATTERNS are authoritative

---
*Phase: 03-plugin-integration-custom-commands*
*Completed: 2026-03-21*
