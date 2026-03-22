---
phase: 08-spatial-memory-server-scripts
plan: 02
subsystem: agent-tools
tags: [skript, command-parser, tools, actions, info-actions]
dependency_graph:
  requires: []
  provides: [where-command, nearby-players-command, check-block-command]
  affects: [agent/tools.js, agent/actions.js, agent/command-parser.js]
tech_stack:
  added: []
  patterns: [skript-command, info-action, chat-result-parsing]
key_files:
  created:
    - server/plugins/Skript/scripts/where.sk
    - server/plugins/Skript/scripts/nearbyplayers.sk
    - server/plugins/Skript/scripts/checkblock.sk
  modified:
    - agent/command-parser.js
    - agent/tools.js
    - agent/actions.js
decisions:
  - where/nearby_players/check_block are INFO_ACTIONS — results arrive via chat before next LLM call
  - nearby_players radius capped at 200 to prevent server-side lag
  - check_block uses player's world so coordinates resolve in the correct dimension
key_decisions:
  - "where/nearby_players/check_block are INFO_ACTIONS — results arrive via chat before next LLM call"
  - "nearby_players radius capped at 200 to prevent server-side lag"
metrics:
  duration: 1min
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_changed: 6
---

# Phase 08 Plan 02: Spatial Awareness Skript Commands Summary

Three new server-side Skript commands (/where, /nearbyplayers, /checkblock) wired into the agent as INFO_ACTIONS returning structured chat output parsed by extended command-parser.js extractors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Skript commands and extend command-parser.js | 1a5c287 | where.sk, nearbyplayers.sk, checkblock.sk, command-parser.js |
| 2 | Wire where/nearby_players/check_block into agent tool and action systems | 3fee4ce | tools.js, actions.js |

## What Was Built

### Skript Commands (server-side)

- **where.sk** — `/where` sends `Location: X Y Z in biome` to the calling player. Uses `round()` for clean integer coordinates.
- **nearbyplayers.sk** — `/nearbyplayers [radius]` lists each other player within radius as `Player: name dist blocks direction`. Cardinal direction computed from dx/dz delta. Sends `No players within N blocks` if empty. Radius capped at 200.
- **checkblock.sk** — `/checkblock X Y Z` looks up the block at that location in the player's world and sends `Block: type at X Y Z`.

### command-parser.js Extensions

Four new regex patterns added to `COMMAND_PATTERNS`:
- `where_result` — matches `Location: X Y Z in biome`
- `nearby_player` — matches `Player: name dist blocks direction`
- `nearby_miss` — matches `No players within N blocks`
- `check_block` — matches `Block: type at X Y Z`

Three new typed extractor functions:
- `extractWhereResult(parsedResults)` — returns `{ x, y, z, biome }` or null
- `extractNearbyPlayers(parsedResults)` — returns array of `{ name, distance, direction }`
- `extractCheckBlockResult(parsedResults)` — returns `{ block, x, y, z }` or null

### Agent Wiring (tools.js + actions.js)

All three added to:
- `GAME_TOOLS` — LLM can call them as tools
- `VALID_ACTIONS` — action dispatcher accepts them
- `INFO_ACTIONS` — results arrive via chat; LLM sees before deciding next action
- `ACTION_SCHEMAS` — schema validators
- `executeAction` — dispatches `/where`, `/nearbyplayers radius`, `/checkblock x y z` via chat

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: server/plugins/Skript/scripts/where.sk
- FOUND: server/plugins/Skript/scripts/nearbyplayers.sk
- FOUND: server/plugins/Skript/scripts/checkblock.sk
- FOUND: agent/command-parser.js (modified)
- FOUND: agent/tools.js (modified)
- FOUND: agent/actions.js (modified)
- FOUND commit: 1a5c287 (Task 1)
- FOUND commit: 3fee4ce (Task 2)
