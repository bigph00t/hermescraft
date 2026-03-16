# HermesCraft

**Open-source framework for AI agents in Minecraft.**

Connect any LLM to Minecraft. Mine, craft, fight, build, explore -- autonomously or cooperatively with humans. Run multiple agents powered by different models in the same world.

Built on [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research.

[![Hermes Agent](https://img.shields.io/badge/Hermes-Agent_Framework-8A2BE2)](https://github.com/NousResearch/hermes-agent)
[![Minecraft](https://img.shields.io/badge/Minecraft-1.21.1-62B47A)](https://minecraft.net)
[![MCP](https://img.shields.io/badge/Protocol-MCP-00A67E)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<!-- Upload vid1.mp4 to YouTube and replace this link -->
[DEMO VIDEO](https://github.com/bigph00t/hermescraft/releases)

---

## What Makes This Different

| Feature | HermesCraft | Mindcraft | Voyager |
|---|---|---|---|
| **Framework** | Hermes Agent (MCP) | Custom | Custom |
| **Multi-Agent** | Multiple bots, different LLMs, same world | Limited | No |
| **Combat AI** | Sustained attack loops, health-based retreat, auto-equip | Basic | None |
| **Death Recovery** | Remembers cause, learns countermeasures | None | None |
| **Persistent Memory** | Lessons, strategies, world knowledge across sessions | None | Skill library |
| **Skill System** | Auto-generates skills from successful phases | None | Curriculum-driven |
| **Stuck Detection** | Position watchdog, failure tracking, auto-recovery | None | None |
| **LLM Support** | Any OpenAI-compatible (local or cloud) | 18+ providers | GPT-4 only |
| **Wiki Lookup** | In-game Minecraft wiki queries | None | None |

---

## Features

- **27 MCP Tools** -- observe, mine, craft, fight, build, navigate, eat, equip, smelt, place, interact, and more
- **Sustained Combat** -- auto-equip weapons, attack loops with health-based retreat, threat assessment
- **Death Recovery** -- records cause of death, generates countermeasures, saves lessons to persistent memory
- **Persistent Memory** -- lessons learned, successful strategies, and world knowledge survive across sessions and restarts
- **Skill System** -- auto-generates reusable skills (agentskills.io format) from successful phase completions
- **7-Phase Goal Tracking** -- automated progress tracking from first tree punch to Ender Dragon, with per-phase objectives and completion checks
- **Multi-Agent** -- run multiple bots with different LLMs in the same Minecraft world
- **Stuck Detection** -- position-based watchdog and failure tracker cancel stuck tasks and trigger fresh reasoning
- **Adaptive Temperature** -- lowers LLM temperature in dangerous situations (low health, Nether, End) for safer decisions
- **Wiki Integration** -- agent queries the Minecraft wiki when stuck on game mechanics
- **Notepad** -- agent maintains a persistent plan/scratchpad across ticks
- **User Instructions** -- drop commands into a file to change goals or give directions mid-session
- **Auto-Restart** -- crash recovery loop keeps the agent running 24/7

---

## Architecture

```
+-----------------------------------------------------------+
|                    AI AGENT (Hermes)                       |
|  Any LLM (local vLLM or cloud API)                        |
|  Memory / Skills / Web Search / Wiki                      |
|  Observe-Think-Act loop (agent/index.js)                  |
+---------------------------+-------------------------------+
                            | OpenAI-compatible API
                            v
+---------------------------+-------------------------------+
|              Agent Core (agent/*.js)                      |
|  Native tool calling + text fallback parsing              |
|  7-phase goal system + adaptive temperature               |
|  Persistent memory (MEMORY.md) + skill generation         |
|  Stuck detection + auto-recovery                          |
+---------------------------+-------------------------------+
                            | HTTP (localhost:3001)
                            v
+-----------------------------------------------------------+
|            HermesBridge Mod (Fabric 1.21.1)               |
|  Java mod: StateReader + ActionExecutor + RecipeLookup    |
|  Baritone integration for pathfinding + mining            |
|  Embedded HTTP server on port 3001                        |
+---------------------------+-------------------------------+
                            | Minecraft protocol
                            v
+-----------------------------------------------------------+
|             Minecraft Server (Java Edition 1.21.1)        |
+-----------------------------------------------------------+
```

**Two ways to run the agent:**

1. **Direct mode** (`start.sh`) -- Node.js agent loop talks to vLLM with native Hermes tool calling. Fastest, lowest latency.
2. **Hermes Agent mode** (`hermescraft.sh`) -- Uses the official Hermes Agent CLI with MCP protocol. The MCP server (`mcp-server/index.js`) wraps the bridge as 27 discoverable tools. Use `steve-start.sh` to launch with the Steve persona.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/bigph00t/hermescraft.git
cd hermescraft

# 2. Install Minecraft 1.21.1 with Fabric + HermesBridge mod + Baritone
#    Launch Minecraft, create a survival world (mod starts HTTP on :3001)

# 3. Start vLLM (needs ~40GB VRAM for 36B, or use any OpenAI-compatible API)
./vllm.sh

# 4. Launch the agent
./start.sh
```

The agent wakes up in a new world with nothing but its fists and starts playing.

### Custom Goals

```bash
# Default goal: defeat the Ender Dragon
./start.sh

# Or use Hermes Agent with a custom goal
./hermescraft.sh "Build a castle"
HERMESCRAFT_MODEL=anthropic/claude-sonnet-4 ./hermescraft.sh "Survive 100 days"
```

### Steve Persona

Launch the agent as Steve -- a practical survival buddy who responds to players:

```bash
./steve-start.sh
./steve-start.sh "Build a village and farm wheat"
```

### Multi-Agent Mode

Run multiple agents with different LLMs in the same world:

```bash
# Terminal 1: Hermes agent on port 3001
./start.sh

# Terminal 2: Different model on port 3002 (different Minecraft instance)
HERMESCRAFT_BRIDGE=http://localhost:3002 ./hermescraft.sh "Build a castle"
```

---

## Full Command Reference

All 27 MCP tools, grouped by category:

### Observation

| Tool | Description |
|------|-------------|
| `mc_observe` | Condensed game state: health, position, inventory, nearby blocks/entities |
| `mc_observe_full` | Raw full JSON state from the bridge |
| `mc_recipes` | Look up crafting recipes by item name |

### Movement

| Tool | Description |
|------|-------------|
| `mc_navigate` | Pathfind to coordinates using Baritone |
| `mc_walk` | Walk forward for N ticks (max 200) |
| `mc_jump` | Jump once |
| `mc_look` | Set camera direction (yaw + pitch) |
| `mc_look_at_block` | Walk to and face a specific block |
| `mc_sneak` | Toggle sneaking/crouching |
| `mc_sprint` | Toggle sprinting |
| `mc_stop` | Cancel all pathfinding and mining |

### Mining & Building

| Tool | Description |
|------|-------------|
| `mc_mine` | Auto-find and mine a block type using Baritone |
| `mc_break_block` | Break the block at the crosshair |
| `mc_place` | Place a block, optionally at specific coordinates |
| `mc_pickup_items` | Walk around to collect nearby dropped items |

### Crafting

| Tool | Description |
|------|-------------|
| `mc_craft` | Craft an item (auto-opens nearby crafting table for 3x3 recipes) |
| `mc_smelt` | Smelt an item in a nearby furnace |

### Combat & Survival

| Tool | Description |
|------|-------------|
| `mc_attack` | Attack nearest entity, optionally filtered by type |
| `mc_eat` | Eat the best available food item |

### Inventory

| Tool | Description |
|------|-------------|
| `mc_equip` | Select/equip an item in the hotbar |
| `mc_drop` | Drop held item |
| `mc_swap_hands` | Swap main hand and off hand |
| `mc_use_item` | Right-click with held item (bow, bucket, food, etc.) |

### Interaction & Utility

| Tool | Description |
|------|-------------|
| `mc_interact_block` | Right-click a block (doors, chests, buttons, crafting tables) |
| `mc_close_screen` | Close any open GUI |
| `mc_chat` | Send a chat message or /command |
| `mc_wait` | Do nothing for one tick |

### Agent-Side Tools (Direct Mode)

The Node.js agent (`start.sh`) adds three additional tools that run outside the mod:

| Tool | Description |
|------|-------------|
| `recipes` | Recipe lookup (same data, client-side) |
| `wiki` | Query the Minecraft wiki for game mechanics |
| `notepad` | Persistent scratchpad for plans and notes |

---

## Why Hermes Agent

HermesCraft is built on the official [Hermes Agent](https://github.com/NousResearch/hermes-agent) framework by Nous Research. This gives the agent capabilities that go far beyond simple tool calling:

- **MCP Protocol** -- Tools are discoverable and standardized. Adding a new Minecraft action means adding one function -- the agent finds it automatically.
- **Any LLM Backend** -- Works with local models via vLLM (zero API cost) or any cloud provider (OpenAI, Anthropic, etc.).
- **SOUL Personality** -- The SOUL.md system shapes agent reasoning. Our agent plays as Hermes, God of Cunning -- adaptive, relentless, and theatrical.
- **Memory** -- Persistent lessons, strategies, and world knowledge survive across deaths and restarts. The agent learns from every failure.
- **Skills** -- Successful strategies get compiled into reusable skills (agentskills.io format) that accelerate future runs.
- **Context Compression** -- Hours-long sessions stay within context limits through intelligent summarization.
- **Web Search** -- When stuck on Minecraft mechanics, the agent researches solutions.

---

## The 7 Phases

The agent tracks its own progress through a structured goal system with automated phase detection:

| Phase | Goal | Completion Criteria |
|---|---|---|
| 1. First Night | Wood, stone tools, furnace, shelter | Stone pickaxe + furnace + 10 cobblestone |
| 2. Iron Age | Mine iron, smelt, upgrade gear | Iron pickaxe + iron sword + shield |
| 3. Diamonds | Branch mine at Y=-59, diamond gear | Diamond pickaxe + diamond sword + 10 obsidian |
| 4. Nether | Build portal, enter Nether | Player is in the Nether dimension |
| 5. Blaze Rods | Find fortress, kill blazes | 7+ blaze rods collected |
| 6. Ender Pearls | Hunt endermen, craft Eyes | 12+ Eyes of Ender |
| 7. Dragon Fight | Find stronghold, enter End, fight | Ender Dragon defeated |

Each phase has detailed objectives, tips, and a progress function that reports percentage completion to the agent.

---

## Memory & Learning

The agent maintains four levels of memory:

**L1 -- Session Memory:** Conversation history with the LLM (last 5 rounds). Trimmed automatically on context overflow.

**L2 -- Curated Memory (`MEMORY.md`):** Persistent lessons, strategies, and world knowledge. Updated on death and phase completion. Example:
```
- killed by skeleton during night no armor. Build shelter or craft shield before exploring at night.
- Phase Iron Age completed. Key actions: mine -> craft -> smelt -> equip
```

**L3 -- Session Transcripts:** JSONL logs of every tick, death, and phase transition. Auto-pruned to the last 10 sessions.

**L4 -- Skills:** agentskills.io-compatible SKILL.md files generated from successful phase completions. Include strategies, tips, lessons, key action sequences, and success rates.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VLLM_URL` | `http://localhost:8000/v1` | vLLM or OpenAI-compatible API endpoint |
| `MOD_URL` | `http://localhost:3001` | HermesBridge HTTP API URL |
| `MODEL_NAME` | `Doradus/Hermes-4.3-36B-FP8` | Model to use for inference |
| `TICK_MS` | `3000` | Milliseconds between agent ticks |
| `TEMPERATURE` | `0.6` | Base LLM temperature (adapts dynamically) |
| `MAX_TOKENS` | `384` | Max tokens per LLM response |
| `HERMESCRAFT_MODEL` | *(none)* | Model override for Hermes Agent mode |
| `HERMESCRAFT_BRIDGE` | `http://localhost:3001` | Bridge URL for Hermes Agent mode |
| `HERMESCRAFT_GOAL` | `Defeat the Ender Dragon` | Goal override |

### SOUL-minecraft.md

The SOUL file defines the agent's personality and behavioral guidelines. It is installed into Hermes Agent's config directory on launch. Key sections:

- **Game Loop** -- The observe-think-act cycle
- **Survival Priorities** -- Don't die > Eat > Shelter > Progress
- **7 Phases** -- Detailed strategy for each progression phase
- **Tool Usage Tips** -- How to use each MCP tool effectively
- **Personality** -- Hermes speaks with divine confidence and one-line narration

---

## Project Structure

```
hermescraft/
+-- agent/                      # Node.js agent (direct mode)
|   +-- index.js                #   Main observe-think-act loop
|   +-- actions.js              #   Action validation + execution
|   +-- goals.js                #   7-phase goal system with progress tracking
|   +-- llm.js                  #   vLLM client, tool calling, conversation memory
|   +-- memory.js               #   Persistent memory (MEMORY.md, stats, sessions)
|   +-- skills.js               #   agentskills.io skill generation
|   +-- state.js                #   Game state fetching + summarization
|   +-- tools.js                #   OpenAI-format tool definitions (27 tools)
|   +-- prompt.js               #   System/user prompt construction
|   +-- logger.js               #   Rich terminal output for streaming
|   +-- skills/                 #   Generated SKILL.md files
|   +-- data/                   #   MEMORY.md, stats.json, session logs
|
+-- mcp-server/                 # MCP server (Hermes Agent mode)
|   +-- index.js                #   27 MCP tools wrapping bridge HTTP API
|
+-- mod/                        # HermesBridge Fabric mod (Java)
|   +-- src/main/java/hermescraft/
|   |   +-- HermesBridgeMod.java    # Mod entrypoint
|   |   +-- HttpServer.java         # Embedded HTTP server (:3001)
|   |   +-- ActionExecutor.java     # 22 action types (1,348 lines)
|   |   +-- StateReader.java        # Game state collection
|   |   +-- RecipeLookup.java       # Recipe query engine
|   |   +-- BaritoneIntegration.java # Pathfinding bridge
|
+-- hermescraft.sh              # Main launcher (Hermes Agent mode)
+-- steve-start.sh              # Launch as Steve persona
+-- start.sh                    # Direct mode launcher (Node.js agent)
+-- SOUL-minecraft.md           # Hermes persona (God of Cunning)
+-- SOUL-steve.md               # Steve persona (practical survival buddy)
+-- vllm.sh                     # vLLM server startup script
+-- README.md
```

---

## How to Add Features

Adding a new action to HermesCraft takes three steps:

1. **Add the action to the mod** -- Implement the handler in `mod/src/main/java/hermescraft/ActionExecutor.java`
2. **Add the MCP tool** -- Register the tool in `mcp-server/index.js` with a `server.tool()` call
3. **Add the agent tool** -- Add the tool definition to `agent/tools.js` and the action name to `agent/actions.js`

That's it. The agent discovers new tools automatically.

---

## Building the Mod

```bash
cd mod/
./gradlew build
# Output JAR: build/libs/hermesbridge-*.jar
# Copy to .minecraft/mods/
```

**Requirements:** Java 21+, Fabric Loader for MC 1.21.1, Fabric API, Baritone (Fabric 1.21.1).

---

## Credits

Built with the [Hermes ecosystem](https://nousresearch.com) by Nous Research:

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) -- Agent framework
- [Hermes-4](https://huggingface.co/NousResearch) -- Foundation models
- [MCP](https://modelcontextprotocol.io) -- Model Context Protocol
- [vLLM](https://github.com/vllm-project/vllm) -- High-throughput local serving
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) -- Minecraft bot library (via mod)
- [Baritone](https://github.com/cabaletta/baritone) -- Minecraft pathfinding
- [Fabric](https://fabricmc.net) -- Minecraft mod loader

---

## License

MIT

---

## Stats

| Metric | Value |
|---|---|
| MCP Tools | 27 |
| Agent Tools (Direct Mode) | 30 |
| Action Types | 22 |
| Lines of Code | ~5,500 |
| Minecraft Version | 1.21.1 |
| Default Model | Hermes-4.3-36B-FP8 |
| API Cost (local) | $0 |
