# HermesCraft: AI Agents That Play Minecraft Like People

## What This Is

A Minecraft AI agent system where AI characters (Jeffrey Enderstein, John Kwon, Alex, Anthony) play like real humans on a Survival Island. They build structures with aesthetic intent using freestyle LLM-designed plans, gather resources from visible surfaces, explore and name locations with typed spatial memory, trade surplus items via chest interaction, craft complex items with automatic dependency resolution, learn skills over time, and have genuine conversations referencing their backstories — all driven by LLM reasoning with visual awareness and post-build verification.

## Core Value

Agents must feel and play like real people — creative, emotional, with desires, aesthetic sense, and the ability to look at the world around them and interact with what they see. A human observer watching for 30 minutes shouldn't immediately tell they're bots.

## Requirements

### Validated

- ✓ Multi-agent system with per-agent memory, skills, social tracking — v1
- ✓ 3-loop architecture (action/vision/planner) with shared state — v1
- ✓ Claude Haiku vision for screenshot analysis — v1
- ✓ MiniMax M2.7 for action and planning LLM calls — v1
- ✓ Deep personality SOUL files for each agent — v1
- ✓ HermesBridge Fabric client mod (HTTP API for state/actions) — v1
- ✓ Paper 1.21.1 server with 12 plugins — v1.0
- ✓ Agent spatial awareness: surfaceBlocks + look_at_block + break_block — v1.0
- ✓ Brain-hands-eyes architecture: planner writes queue, action loop executes — v1.0
- ✓ Custom Skript commands: /scan, /share-location, /myskills — v1.0
- ✓ 8 plugin-backed agent tools — v1.0
- ✓ Creative intelligence with BUILD vision evaluation — v1.0
- ✓ SOUL files with creative drives, anti-meta-game enforcement — v1.0
- ✓ Smart place: auto-equip from full 36-slot inventory, support block + face model — v1.1
- ✓ Chest interaction: deposit/withdraw with auto-tracking to chests.json — v1.1
- ✓ Mine action removed: all block breaking via look_at_block + break_block only — v1.1
- ✓ Item name normalization: 18-alias normalizer.js with minecraft-data validation — v1.1
- ✓ Sustained action timeout self-clear — v1.1
- ✓ Crafting chain solver: BFS with minecraft-data, variant selection, 3x3 table detection — v1.1
- ✓ Planner auto-expands craft X into dependency-ordered steps — v1.1
- ✓ Freestyle building: LLM designs ## BUILD: plans, block-by-block execution — v1.1
- ✓ Block placement tracking: persistent placed_blocks.json — v1.1
- ✓ Post-build verification: placed_count:N deterministic check — v1.1
- ✓ Typed spatial memory: resource patches with proximity-filtered prompt injection — v1.1
- ✓ 6 Skript server commands: /scan, /share-location, /myskills, /where, /nearbyplayers, /checkblock — v1.1

### Active

(No active requirements — next milestone not yet defined)

### Out of Scope

- Scoreboard display — user doesn't want it
- Custom Paper plugin (Java) — use Skript for custom commands
- Nether/End gameplay — focus on overworld island survival first
- Hostile mob combat — peaceful mode for building/cooperation focus
- Mineflayer integration — fix existing mod-based primitives instead
- LLM-generated block coordinates — LLM designs high-level, agent executes deterministically
- Real-time voxel world map — enormous memory cost, POI map suffices

## Context

### Current State (post v1.1)
- Server: Paper 1.21.1 (build #133) in Docker on Glass with 12 plugins
- Clients: 2x Fabric clients with HermesBridge mod + Baritone, running in Xvfb
- Agent: Node.js ESM with 3 async loops (action 2s, vision 10s, planner 30s)
- LLM: MiniMax M2.7 for text, Claude Haiku for vision BUILD evaluation
- Codebase: ~9,000 LOC JavaScript (agent), ~2,900 LOC Java (mod), ~100 LOC Skript
- 4 SOUL files with deep personality + creative subsections
- 41 agent tools (32 game + 9 plugin/info)
- New modules: normalizer.js, crafter.js, freestyle.js, placement-tracker.js
- Known tech debt: 3 stale mine refs in index.js, 3 dead command-parser extractors, VeinMiner sneak undocumented, ServerTap port not Docker-exposed

## Constraints

- **Server hardware**: Glass has 15GB RAM, running MC server + 2 clients + 2 agents
- **LLM cost**: MiniMax M2.7 is cheap. Claude Haiku for vision on user's subscription
- **MC version**: Must stay on 1.21.1 for Baritone compatibility
- **Client mods**: HermesBridge and Baritone are client-side only
- **Difficulty**: Peaceful mode (no hostile mobs) — focus on building and cooperation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paper over Fabric server | Plugin ecosystem, performance | ✓ Good — 12 plugins running |
| Skript over custom Java plugin | Faster iteration, no compilation | ✓ Good — 6 commands |
| Look+break over Baritone #mine | Prevents underground tunneling | ✓ Good — mine removed entirely in v1.1 |
| Keep MiniMax for LLM | Cheap, fast, adequate quality | ✓ Good |
| Claude Haiku for vision | Image understanding, BUILD evaluation | ✓ Good — drives creative feedback loop |
| Brain-hands-eyes architecture | Planner is brain, action loop is hands | ✓ Good — queue-based execution |
| No artificial token limits | Let LLM generate naturally | ✓ Good |
| Creative debt counter | Forces creative activity after gathering | ✓ Good — 5-cycle threshold |
| Two-layer meta-game filter | Prompt trains LLM + regex backstop | ✓ Good |
| Smart place replaces place | Support block + face model, full inventory equip | ✓ Good — fixes 90% failure rate |
| minecraft-data for recipes | Static DB, not runtime /recipes calls | ✓ Good — 782 recipe types loaded at startup |
| Freestyle replaces blueprints | LLM designs, agent executes deterministically | ✓ Good — 200-block cap, context file persistence |
| Proximity-filtered spatial prompts | Prevents unbounded context growth | ✓ Good — 150-block radius, hard caps |
| Response-driven state updates | Embed state in action response, not polling | ✓ Good — placed blocks, chest contents |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after v1.1 milestone*
