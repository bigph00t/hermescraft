# Phase 8: Spatial Memory + Server Scripts - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the agent's spatial awareness with typed resource patches (ore veins, tree clusters, build sites) in persistent spatial memory. Add proximity-filtered prompt injection so 100+ entries don't bloat the prompt. Create new Skript server commands (/where, /nearbyplayers, /checkblock) with command-parser.js extensions.

</domain>

<decisions>
## Implementation Decisions

### Spatial Memory (locations.js Extension)
- Extend existing agent/locations.js with typed resource patches
- Types: ore_vein, tree_cluster, build_site, chest, poi (point of interest)
- Each entry: {name, type, x, y, z, dimension, timestamp, metadata}
- Auto-detection: ore veins found during look_at_block/break_block, tree clusters from surfaceBlocks, build sites from freestyle building
- Save to existing locations.json with a new `resources` section alongside the existing `locations` section
- Provide getResourcesForPrompt() — proximity-filtered, shows only entries within configurable radius (default 150 blocks)
- Hard cap: maximum 20 entries in prompt injection regardless of proximity filter
- Growth management: when total entries exceed 500, prune oldest entries of same type within 10 blocks (dedup)

### Proximity-Filtered Prompt Injection
- getLocationsForPrompt() and getChestsForPrompt() also need proximity filtering (research flagged unbounded growth)
- Apply same pattern: only show entries within 150 blocks of current position
- Cap at 10 entries each for locations and chests in prompt
- Agent can still query all entries via a tool call if needed

### New Skript Commands
- /where — tells the player their current coordinates and biome
- /nearbyplayers — lists players within 100 blocks with distance and direction
- /checkblock <x> <y> <z> — reports the block type at given coordinates
- All commands return formatted output that command-parser.js can parse
- Deploy to Paper server plugins/Skript/scripts/ directory
- Hot-reload via /skript reload all (no MC restart)

### Command Parser Extensions
- Extend agent/command-parser.js with parsers for new command outputs
- Follow existing pattern: regex-based extraction from chat messages
- Parse /where output into {x, y, z, biome}
- Parse /nearbyplayers output into [{name, distance, direction}]
- Parse /checkblock output into {block, x, y, z}

### Agent Tool Wiring
- Add where, nearby_players, check_block to GAME_TOOLS
- These are INFO_ACTIONS — results come back via chat, LLM sees them before acting
- Follow existing scan_blocks pattern for info action handling

### Claude's Discretion
All implementation details within the above constraints are at Claude's discretion — infrastructure phase

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- agent/locations.js — existing named location system with locations.json persistence
- agent/chests.js — chest tracking with chests.json, getChestsForPrompt()
- agent/command-parser.js — regex-based chat message parser for /scan, /share-location, /myskills
- agent/servertap.js — ServerTap REST API client for console commands
- Skript scripts in server: scan.sk, share-location.sk, myskills.sk (existing patterns)
- agent/tools.js — GAME_TOOLS, INFO_ACTIONS sets

### Established Patterns
- Location entries: {name, x, y, z, dimension} in locations.json
- Chat command results: parsed by command-parser.js regex extractors
- INFO_ACTIONS: agent-side-only, results via chat, LLM sees before acting
- Skript variable namespacing: {varname::%player name%::*} for multi-agent safety

### Integration Points
- locations.js getResourcesForPrompt() injected into buildUserMessage() in prompt.js
- Proximity filter uses agent position from game state (state.position)
- New tools added to GAME_TOOLS + INFO_ACTIONS in tools.js
- New handlers in actions.js (servertap.js executeCommand pattern)
- command-parser.js extended with new parse functions
- Skript files deployed to Docker container via servertap or docker cp

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Research (ARCHITECTURE.md, PITFALLS.md) flagged the unbounded growth issue in getLocationsForPrompt() and getChestsForPrompt() as critical to address in this phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
