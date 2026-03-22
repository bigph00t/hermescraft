---
phase: 03-plugin-integration-custom-commands
plan: 03
subsystem: agent
tags: [prompt, planner, state, index, plugin-wiring, skill-cache, command-results, servertap]

# Dependency graph
requires:
  - phase: 03-plugin-integration-custom-commands
    plan: 01
    provides: command-parser.js (parseRecentChat, formatPluginResponse, extractScanResults, extractSkillLevels) and servertap.js
  - phase: 03-plugin-integration-custom-commands
    plan: 02
    provides: 8 plugin tools in tools.js, 8 action handlers in actions.js, isAbilityOnCooldown(), INFO_ACTIONS with scan_blocks + check_skills

provides:
  - Plugin tools section in GAMEPLAY_INSTRUCTIONS (prompt.js)
  - pluginResponse injection in buildUserMessage (prompt.js)
  - Plugin strategy guidance in planner system prompt with skill personality flavor (D-15) (planner.js)
  - formatLastCommandResults helper for planner context injection (command-parser.js)
  - updatePlannerPluginState() setter exported from planner.js for index.js to push state
  - All 8 plugin action types in planner parseQueueFromPlan switch and Valid types line
  - ServerTap data in state summary via async cache (state.js)
  - _lastCommandResult Map and _skillCache with _skillCacheAge in index.js (D-09, D-12)
  - Plugin response parsing from recentChat injected into user message each tick
  - INFO_ACTIONS handlers for scan_blocks and check_skills in index.js tick loop

affects:
  - All future agent runs — plugin capabilities now visible to LLM in system prompt
  - Planner quality — skill personality and recent command context available each cycle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Async ServerTap cache pattern: fire-and-forget refresh in fetchState(), sync read in summarizeState()
    - Module-level setter pattern: updatePlannerPluginState() lets index.js push state to planner without coupling
    - Persistent plugin result pattern: _lastCommandResult Map keyed by command type, entries expire after 120s
    - Skill personality flavor: _skillCache entries formatted as "skill LvN (skilled/expert)" injected into planner user content

key-files:
  created: []
  modified:
    - agent/prompt.js
    - agent/planner.js
    - agent/state.js
    - agent/index.js
    - agent/command-parser.js

key-decisions:
  - "updatePlannerPluginState() setter pattern chosen over param passing — planner runs on its own setInterval, not called directly by index.js"
  - "State push every tick (not just planner cycles) — ensures planner always has freshest skill data when it fires"
  - "GAMEPLAY_INSTRUCTIONS no-slash line uses 'natural abilities, not commands' phrasing — avoids embedding literal /slash patterns that would fail the no-slash test"
  - "ServerTap cache fire-and-forget in fetchState() — keeps summarizeState() synchronous, avoids adding async to every caller"
  - "_skillCacheAge incremented every tick — provides approximate cycle count for D-12 refresh tracking"

patterns-established:
  - "Plugin response flow: recentChat -> parseRecentChat -> formatPluginResponse -> buildUserMessage pluginResponse param -> LLM user message"
  - "Scan result persistence: extractScanResults -> _lastCommandResult.set('scan', ...) -> updatePlannerPluginState -> planner context"

requirements-completed: [INT-03, INT-04, INT-05, INT-06, INT-07]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 03 Plan 03: Plugin Wiring — Prompt, Planner, State, Tick Loop Summary

**Full plugin integration wiring: GAMEPLAY_INSTRUCTIONS teaches LLM about 8 plugin tools, planner gets strategy guidance + skill personality + persistent command results, ServerTap enriches state summary, skill cache and scan results persist across ticks**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T23:03:34Z
- **Completed:** 2026-03-21T23:07:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- prompt.js: 8 plugin tool descriptions added to GAMEPLAY_INSTRUCTIONS (scan_blocks, set_home, go_home, share_location, check_skills, use_ability, query_shops, create_shop) with ability names (Treecapitator, Speed Mine, Terraform), 4-step shop creation sequence, and no-slash-command instruction (D-28). `pluginResponse` optional parameter added to `buildUserMessage` with injection after vision context.
- command-parser.js: `formatLastCommandResults(resultMap)` exported — formats Map entries into compact "Recent command results: cmd: summary (Ns ago)" string, skips entries older than 120s.
- planner.js: Import `formatLastCommandResults` from command-parser.js. Add `updatePlannerPluginState(skillCache, lastCommandResults)` exported setter. System prompt expanded with plugin strategy section (scan_blocks, home, skills, shops, 3-step shop guidance). Valid types line includes all 8 new action types. `parseQueueFromPlan` switch extended with cases for all 8 types. D-15 skill personality injected as "Your skills: foraging Lv15 (skilled), ..." in user content. D-09 recent command results injected via `formatLastCommandResults`.
- state.js: Import `getServerInfo, getPlayers, formatServerSummary` from servertap.js. Add `_serverSummaryCache` + `_serverSummaryLastFetch` + `refreshServerSummary()` async function with 60s interval. Fire-and-forget call in `fetchState()`. Cache appended in `summarizeState()` (D-24).
- index.js: Import `parseRecentChat, formatPluginResponse, extractScanResults, extractSkillLevels` from command-parser.js; `isAbilityOnCooldown` from actions.js; `updatePlannerPluginState` from planner.js. Add `_lastCommandResult` Map, `_skillCache` object, `_skillCacheAge` counter, `SKILL_CACHE_REFRESH_CYCLES = 5`. Each tick: parse recentChat into pluginResponse + persist scan/skill results in _lastCommandResult + update _skillCache + push to planner via updatePlannerPluginState. INFO_ACTIONS block extended with scan_blocks and check_skills handlers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update prompt.js GAMEPLAY_INSTRUCTIONS and buildUserMessage** - `17eacce` (feat)
2. **Task 2: Update planner.js, state.js, index.js, and command-parser.js** - `7fe4662` (feat)

## Files Created/Modified

- `agent/prompt.js` — 8 plugin tool descriptions in GAMEPLAY_INSTRUCTIONS, pluginResponse param in buildUserMessage
- `agent/command-parser.js` — formatLastCommandResults() exported
- `agent/planner.js` — updatePlannerPluginState() setter, plugin strategy guidance, expanded valid types, parseQueueFromPlan cases, D-15 personality, D-09 context
- `agent/state.js` — servertap.js import, async ServerTap cache, _serverSummaryCache in summarizeState
- `agent/index.js` — command-parser + planner imports, _lastCommandResult + _skillCache state, plugin parsing per tick, INFO_ACTIONS handlers

## Decisions Made

- `updatePlannerPluginState()` setter pattern chosen over parameter passing — planner fires on its own setInterval, not called directly from index.js; a module-level setter keeps the interface clean without coupling.
- State is pushed to planner on every action tick (not just planner cycles) — ensures the planner always has fresh skill and command result data when it fires ~30s later.
- GAMEPLAY_INSTRUCTIONS no-slash instruction uses "natural abilities, not commands" phrasing to avoid embedding literal `/scan` `/home` text that would fail the D-28 acceptance test.
- ServerTap cache uses fire-and-forget in `fetchState()` to keep `summarizeState()` synchronous — avoids adding `async` to every caller of summarizeState.

## Deviations from Plan

None — plan executed exactly as written. All must_haves and acceptance criteria satisfied.

## Issues Encountered

Minor: Initial GAMEPLAY_INSTRUCTIONS "NEVER mention slash commands, /scan, /home..." line contained the literal `/scan` and `/home` patterns it was trying to prohibit, causing the no-slash test to fail. Fixed by rephrasing to "NEVER reveal slash commands to players. These are your natural abilities, not commands you type."

## Self-Check

---

## Self-Check: PASSED

Files confirmed present:
- agent/prompt.js: FOUND
- agent/command-parser.js: FOUND (formatLastCommandResults exported)
- agent/planner.js: FOUND (updatePlannerPluginState exported, scan_blocks in Valid types)
- agent/state.js: FOUND (_serverSummaryCache variable present)
- agent/index.js: FOUND (_lastCommandResult, _skillCache, parseRecentChat import)

Commits confirmed:
- 17eacce: feat(03-03): add plugin tools to GAMEPLAY_INSTRUCTIONS
- 7fe4662: feat(03-03): wire plugin infrastructure

## Next Phase Readiness

- Phase 03 complete — all 3 plans executed, plugin integration fully wired
- Agents will see plugin tool descriptions every tick via GAMEPLAY_INSTRUCTIONS
- Planner will suggest scan_blocks instead of wandering, reference skill levels as personality
- ServerTap player count and TPS visible in every state summary (when server is available)
- Skill levels accumulate in _skillCache and flow to planner D-15 personality flavor automatically
- scan_blocks and check_skills INFO_ACTIONS fully wired in tick loop

---
*Phase: 03-plugin-integration-custom-commands*
*Completed: 2026-03-21*
