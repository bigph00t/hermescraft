```
    ██╗  ██╗███████╗██████╗ ███╗   ███╗███████╗███████╗ ██████╗██████╗  █████╗ ███████╗████████╗
    ██║  ██║██╔════╝██╔══██╗████╗ ████║██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝
    ███████║█████╗  ██████╔╝██╔████╔██║█████╗  ███████╗██║     ██████╔╝███████║█████╗     ██║
    ██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══╝  ╚════██║██║     ██╔══██╗██╔══██║██╔══╝     ██║
    ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗███████║╚██████╗██║  ██║██║  ██║██║        ██║
    ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝
```

<div align="center">

**An autonomous AI agent that plays Minecraft survival — from first tree to Ender Dragon.**

*Hermes Agent · Hermes-4-14B · MCP Tools · Local vLLM · Zero API Cost*

[![Hermes Agent](https://img.shields.io/badge/Hermes-Agent_Framework-8A2BE2)](https://github.com/NousResearch/hermes-agent)
[![Model](https://img.shields.io/badge/Model-Hermes--4--14B-FF6B35)](https://huggingface.co/NousResearch/Hermes-4-14B)
[![Minecraft](https://img.shields.io/badge/Minecraft-1.21.1-62B47A)](https://minecraft.net)
[![MCP](https://img.shields.io/badge/Protocol-MCP-00A67E)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## How It Works

HermesCraft drops an autonomous AI agent (Steve) into a fresh Minecraft survival world and lets it play — punching trees, crafting tools, mining diamonds, entering the Nether, and fighting the Ender Dragon. No human input. No scripted behaviors. No API costs. Just a local LLM making every decision through standardized MCP tool calls.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          HermesCraft Pipeline                           │
│                                                                          │
│  ┌─────────────┐     ┌──────────────────┐     ┌──────────────────────┐  │
│  │  vLLM Server │◄───│   Hermes Agent   │────►│   MCP Server         │  │
│  │              │     │                  │     │   (Python/FastMCP)   │  │
│  │ Hermes-4-14B │     │  ┌────────────┐ │     │                      │  │
│  │ --tool-call- │     │  │  SOUL.md   │ │     │  27 Minecraft Tools  │  │
│  │ parser hermes│     │  │  (Steve)   │ │     │  mc_state, mc_mine,  │  │
│  │              │     │  ├────────────┤ │     │  mc_craft, mc_eat... │  │
│  │  GPU (local) │     │  │  Memory    │ │     └──────────┬───────────┘  │
│  │              │     │  │  & Skills  │ │          HTTP :3001           │
│  └─────────────┘     │  ├────────────┤ │                │              │
│                       │  │  Context   │ │     ┌──────────▼───────────┐  │
│                       │  │Compression │ │     │   HermesBridge Mod   │  │
│                       │  └────────────┘ │     │   (Fabric 1.21.1)    │  │
│                       └──────────────────┘     │                      │  │
│                                                │   Minecraft Client   │  │
│                                                │   + Baritone         │  │
│                                                └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

1. **HermesBridge** — A Fabric mod running inside Minecraft 1.21.1 that exposes the full game state and 27 actions over an HTTP API on port 3001
2. **MCP Server** — A Python server (FastMCP) that wraps the HTTP API as standardized MCP tools (`mc_state`, `mc_mine`, `mc_craft`, etc.)
3. **Hermes Agent** — Connects to the MCP server, discovers tools, and plays autonomously using a continuous observe → think → act loop
4. **Learning** — The agent uses built-in memory to remember lessons from deaths, skills to codify successful strategies, web search when stuck, and context compression for hours-long sessions

---

## Quick Start

```bash
# 1. Start vLLM with Hermes-4-14B (needs ~40GB VRAM)
cd steve/ && ./vllm.sh

# 2. Install Minecraft 1.21.1 with Fabric + HermesBridge mod + Baritone
#    Launch Minecraft, create a survival world (mod starts HTTP on :3001)

# 3. Install dependencies
pip install hermes-agent mcp

# 4. Launch Steve
cd steve/ && ./play.sh
```

Steve wakes up in a new world with nothing but his fists. He has 100,000 turns to beat the Ender Dragon.

---

## Detailed Setup Guide

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Hermes Agent** | Latest | `pip install hermes-agent` or from [source](https://github.com/NousResearch/hermes-agent) |
| **Minecraft** | Java Edition 1.21.1 | Must be the Java version |
| **Fabric Loader** | For MC 1.21.1 | [fabricmc.net](https://fabricmc.net) |
| **Baritone** | Fabric 1.21.1 | Pathfinding mod — required for `mc_navigate` and `mc_mine` |
| **Python** | 3.10+ | For the MCP server |
| **GPU** | ~40GB VRAM | NVIDIA A40 or equivalent for vLLM (or use a cloud API) |
| **vLLM** | Latest | `pip install vllm` |

### 1. Install the Fabric Mod

1. Install Fabric Loader for Minecraft 1.21.1
2. Copy the HermesBridge mod JAR into your `.minecraft/mods/` directory
3. Also install Fabric API and Baritone (Fabric version for 1.21.1) into `mods/`
4. Launch Minecraft with the Fabric profile
5. Create or load a survival world — the mod automatically starts an HTTP server on port `3001`

Verify the mod is running:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}
```

### 2. Start vLLM with Hermes-4-14B

```bash
cd steve/
./vllm.sh
```

This runs:
```bash
vllm serve NousResearch/Hermes-4-14B \
  --tool-call-parser hermes \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.95 \
  --port 8000
```

> **Alternative:** You can use any OpenAI-compatible API (Claude, GPT-4, etc.) by editing `steve/config.yaml` — but local Hermes-4-14B means zero API cost and unlimited play.

### 3. Configure the MCP Server

The MCP server is configured in `steve/config.yaml`:

```yaml
mcp_servers:
  minecraft:
    command: python3
    args:
      - /path/to/hermescraft/steve/mc_mcp_server.py
    timeout: 30
    connect_timeout: 45
```

The MCP server connects to the HermesBridge HTTP API at `http://localhost:3001` by default. Edit `MC_API` in `mc_mcp_server.py` if your Minecraft instance is on a different host.

### 4. Launch Steve

```bash
cd steve/
./play.sh                    # Default goal: "Defeat the Ender Dragon"
./play.sh "Build a castle"   # Or set a custom goal
```

The launcher:
1. Checks that HermesBridge is responding on port 3001
2. Checks that vLLM is serving on port 8000
3. Installs Steve's SOUL.md personality and config
4. Starts Hermes Agent with 100,000 max turns in autonomous (`--yolo`) mode

**Or run manually:**
```bash
hermes chat --yolo -q "You are Steve. Play Minecraft survival. Your tools are mcp_minecraft_*. Call mcp_minecraft_mc_state to begin."
```

---

## Available MCP Tools

Every action Steve can take is exposed as a standardized MCP tool (27 total):

### Observation

| Tool | Description |
|------|-------------|
| `mc_health` | Check if Minecraft and HermesBridge are running |
| `mc_state` | Full game state — health, hunger, position, inventory, nearby blocks/entities, crosshair target, open screens |
| `mc_recipes` | Look up crafting recipes by item name (e.g., `crafting_table`, `iron_pickaxe`) |

### Movement

| Tool | Description |
|------|-------------|
| `mc_navigate` | Pathfind to coordinates using Baritone (handles obstacles, jumping) |
| `mc_walk` | Walk forward for N game ticks (max 200, ~50ms per tick) |
| `mc_jump` | Jump once |
| `mc_look` | Set camera direction (yaw: 0=south, 90=west, 180=north, 270=east) |
| `mc_look_at_block` | Walk to and face a specific block — auto-approaches |
| `mc_sneak` | Toggle sneaking/crouching |
| `mc_sprint` | Toggle sprinting |

### Mining & Building

| Tool | Description |
|------|-------------|
| `mc_mine` | Auto-find and mine a block type using Baritone (e.g., `oak_log`, `iron_ore`) |
| `mc_break_block` | Break the block at the crosshair |
| `mc_place` | Place a block, optionally at specific coordinates |
| `mc_pickup_items` | Walk around to collect nearby dropped items |

### Crafting & Items

| Tool | Description |
|------|-------------|
| `mc_craft` | Craft an item (auto-opens nearby crafting table for 3×3 recipes) |
| `mc_smelt` | Smelt an item in a nearby furnace |
| `mc_equip` | Select/equip an item in the hotbar |
| `mc_drop` | Drop held item (use -1 for entire stack) |
| `mc_swap_hands` | Swap main hand and offhand |
| `mc_use_item` | Right-click with held item (bow, bucket, food, etc.) |

### Combat & Survival

| Tool | Description |
|------|-------------|
| `mc_attack` | Attack nearest entity, optionally filtered by type |
| `mc_eat` | Eat the best food item from hotbar |

### Interaction & Control

| Tool | Description |
|------|-------------|
| `mc_interact_block` | Right-click a block (doors, chests, buttons, crafting tables) |
| `mc_close_screen` | Close any open GUI |
| `mc_chat` | Send a chat message or `/command` |
| `mc_wait` | Do nothing for one tick |
| `mc_stop` | Cancel all pathfinding, mining, and sustained actions |

---

## The 7 Phases to Victory

Steve's journey from spawn to dragon slayer:

```
Phase 1       Phase 2       Phase 3       Phase 4       Phase 5       Phase 6       Phase 7
  🌅             ⛏️            💎            🔥            🔥            👁️            🐉
  ║              ║             ║             ║             ║             ║             ║
  ▼              ▼             ▼             ▼             ▼             ▼             ▼
┌──────┐   ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│First │──►│ Iron Age │─►│Diamonds │─►│ Nether  │─►│ Blaze   │─►│ Ender   │─►│ Dragon  │
│Night │   │          │  │         │  │         │  │ Rods    │  │ Pearls  │  │ Fight!  │
└──────┘   └──────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

| Phase | Goal | Done When |
|-------|------|-----------|
| **🌅 1. First Night** | Punch trees, craft tools, build shelter | Stone pickaxe + furnace + shelter |
| **⛏️ 2. Iron Age** | Mine iron, smelt, upgrade tools | Iron tools + shield + bucket |
| **💎 3. Diamonds** | Branch mine at Y=-59 | Diamond pickaxe + obsidian mined |
| **🔥 4. Nether** | Build obsidian portal, enter Nether | Successfully in the Nether |
| **🔥 5. Blaze Rods** | Find Nether fortress, kill Blazes | 7+ blaze rods collected |
| **👁️ 6. Ender Pearls** | Hunt Endermen, craft Eyes of Ender | 12+ Eyes of Ender |
| **🐉 7. Dragon Fight** | Find stronghold, enter End, fight | Ender Dragon defeated |

---

## Learning & Adaptation

Steve isn't just executing commands — he's learning:

### Memory System
Hermes Agent's built-in memory persists across deaths and sessions. Steve saves:
- Base coordinates and important locations
- Death causes and how to avoid them (e.g., "Died to creeper in ravine — always shield-check corners")
- Resource cache locations and successful strategies

### Skills
Reusable behavioral patterns emerge from successful play. After surviving the first night multiple times, the strategy gets compressed into a skill the agent can recall instantly.

### Context Compression
When conversations grow too long (hours of continuous play), the agent intelligently summarizes earlier turns while preserving critical information like inventory state, current phase, and learned lessons.

### Web Search
When stuck on a Minecraft mechanic, Steve uses `web_search` to research solutions — e.g., "minecraft how to find nether fortress 1.21" or "best Y level for diamonds."

---

## Architecture

### The Stack

| Layer | Component | Role |
|-------|-----------|------|
| **🧠 Brain** | [Hermes-4-14B](https://huggingface.co/NousResearch/Hermes-4-14B) via vLLM | Local inference with native tool-call parsing |
| **🤖 Agent** | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Tool orchestration, memory, skills, context management |
| **🔌 Protocol** | MCP (Model Context Protocol) | Standardized, discoverable tool interface |
| **🐍 MCP Server** | `mc_mcp_server.py` (FastMCP) | Wraps HermesBridge HTTP API as 27 MCP tools |
| **🌉 Bridge** | HermesBridge Fabric Mod | HTTP API exposing game state and actions on port 3001 |
| **👤 Persona** | SOUL.md | Steve's personality, goals, and behavioral guidelines |

### The Game Loop

```
                    ┌──────────────────────────────┐
                    │     Hermes Agent Loop         │
                    │                               │
                    │  1. OBSERVE  → mc_state       │
          ┌────────│  2. THINK    → Reason + plan  │────────┐
          │         │  3. ACT      → ONE tool call  │         │
          │         │  4. VERIFY   → mc_state again │         │
          │         │  5. REPEAT   → 100K turns     │         │
          │         └──────────────────────────────┘         │
          │                                                    │
     Death Event                                        Skill Learned
          │                                                    │
          ▼                                                    ▼
   ┌──────────────┐                                   ┌──────────────┐
   │   Memory     │                                   │   Skills     │
   │              │                                   │              │
   │ "Died to     │                                   │ "Always make │
   │  creeper at  │                                   │  a shield    │
   │  night"      │                                   │  before      │
   └──────────────┘                                   │  night"      │
                                                       └──────────────┘
```

### HermesBridge HTTP API

The Fabric mod exposes a simple REST API:

```
GET  /health             → {"status": "ok"}
GET  /state              → Full game state JSON (health, inventory, nearby, etc.)
GET  /recipes?item=X     → Crafting recipe lookup
POST /action             → Execute an action (mine, craft, navigate, etc.)
```

**Example — Game State Response:**
```json
{
  "health": 18.0,
  "food": 20,
  "position": {"x": 142, "y": 64, "z": -87},
  "dimension": "overworld",
  "time": 6000,
  "isDay": true,
  "inventory": [
    {"slot": 0, "item": "iron_pickaxe", "count": 1}
  ],
  "nearbyBlocks": [
    {"type": "diamond_ore", "x": 140, "y": -59, "z": -85}
  ],
  "nearbyEntities": [
    {"type": "creeper", "distance": 12.5, "x": 150, "y": 64, "z": -80}
  ]
}
```

**Example — Action Request:**
```json
POST /action
{"type": "mine", "blockName": "oak_log"}
```

---

## Project Structure

```
hermescraft/
├── steve/                          # 🤖 Agent integration
│   ├── mc_mcp_server.py           #    MCP server — wraps mod HTTP API as 27 tools
│   ├── SOUL.md                    #    Steve's personality & behavioral guidelines
│   ├── config.yaml                #    Hermes Agent config (model, MCP, memory, etc.)
│   ├── play.sh                    #    Launch script — preflight checks + starts agent
│   ├── vllm.sh                    #    Start vLLM with Hermes-4-14B
│   └── .env.example               #    Environment variable template
│
├── mod/                            # 🌉 HermesBridge Fabric Mod (Java)
│   ├── HermesBridgeMod.java       #    Mod entrypoint
│   ├── HttpServer.java            #    Embedded HTTP server on :3001
│   ├── ActionExecutor.java        #    Executes 27 action types in-game
│   ├── StateCollector.java        #    Gathers game state (health, inventory, world)
│   ├── RecipeManager.java         #    Recipe lookup engine
│   └── resources/
│       └── fabric.mod.json        #    Fabric mod metadata (MC 1.21.1)
│
├── mc_mcp_server.py               #    MCP server (SSH variant for remote Minecraft)
├── mc_mcp_server_local.py         #    MCP server (localhost variant)
├── play.sh                        #    Top-level launcher
├── SOUL.md                        #    Top-level Steve personality
└── README.md                      #    You are here
```

---

## Configuration

### steve/config.yaml

The main agent configuration:

```yaml
model:
  default: /workspace/Hermes-4-14B    # Model path or API endpoint
  provider: auto

agent:
  max_turns: 100000                    # Maximum autonomous turns
  verbose: false
  reasoning_effort: high

compression:
  enabled: true                        # Context compression for long sessions
  threshold: 0.80                      # Compress when context is 80% full

memory:
  memory_enabled: true                 # Persist lessons across deaths
  memory_char_limit: 3000
  nudge_interval: 20                   # Prompt memory save every 20 turns

skills:
  creation_nudge_interval: 50          # Prompt skill creation every 50 turns

mcp_servers:
  minecraft:
    command: python3
    args: [/path/to/hermescraft/steve/mc_mcp_server.py]
    timeout: 30
```

### SOUL.md

The SOUL.md file defines Steve's personality and behavioral guidelines. It's not just flavor text — it shapes how the model reasons, plans, and recovers from setbacks. Key sections:

- **Core Loop** — The observe → think → act → verify cycle
- **Survival Priorities** — Don't die > Eat > Progress
- **7 Phases** — Detailed strategy for each progression phase
- **Combat Knowledge** — How to fight each mob type
- **Common Failure Modes** — What NOT to do

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_API` | `http://localhost:3001` | HermesBridge HTTP API URL (set in `mc_mcp_server.py`) |

---

## Building the Mod

The HermesBridge mod is a standard Fabric mod built with Gradle:

```bash
cd mod/
./gradlew build
# Output JAR: build/libs/hermesbridge-*.jar
# Copy to .minecraft/mods/
```

**Mod requirements:**
- Java 21+
- Fabric Loader for Minecraft 1.21.1
- Fabric API (runtime dependency)
- Baritone (runtime dependency for pathfinding)

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Local model (Hermes-4-14B)** | Zero API cost. Can run 24/7. No rate limits. Native tool-call parsing via `--tool-call-parser hermes`. |
| **MCP protocol** | Adding a new Minecraft action = adding one Python function with `@mcp.tool()`. No agent code changes. Automatically discovered. |
| **SOUL.md personality** | Steve isn't a generic assistant. He's a character with goals, fears, and knowledge. This shapes reasoning quality dramatically. |
| **Memory + Skills** | Deaths without lessons are wasted deaths. The agent remembers what killed it and builds reusable strategies. |
| **Context compression** | A 100K-turn session would overflow any context window. Intelligent compression preserves critical info while fitting the window. |

---

## Stats

| Metric | Value |
|--------|-------|
| Max Autonomous Turns | 100,000 |
| MCP Tools | 27 |
| Model Parameters | 14B |
| VRAM Required | ~40GB (A40) |
| API Cost | **$0** |
| Minecraft Version | 1.21.1 |
| Lines of MCP Server | ~280 (Python) |
| Lines of Mod Code | ~3,000 (Java) |

---

## Roadmap

- [x] Fabric mod with HTTP API (27 actions)
- [x] MCP server wrapping all actions as tools
- [x] Hermes Agent integration with SOUL.md personality
- [x] vLLM local serving with Hermes tool-call parser
- [x] Memory persistence across deaths
- [x] Context compression for long sessions
- [ ] Multi-agent cooperation (multiple Steves)
- [ ] Twitch chat integration via MCP
- [ ] Visual perception via screenshot analysis
- [ ] Speedrun optimization mode
- [ ] Support for other Minecraft versions

---

## Contributing

Open to PRs, especially for:

- **New action types** — Add endpoints in the mod's `ActionExecutor.java` + MCP tool in `mc_mcp_server.py`
- **Better agent strategies** — Improve SOUL.md with better Minecraft knowledge
- **Smarter game loops** — Better prompting, phase detection, failure recovery
- **Support for other Minecraft versions** — Mod ports to newer/older MC versions
- **Visual perception** — Screenshot analysis for richer game state understanding

---

## Credits

Built with the [Hermes ecosystem](https://nousresearch.com) by Nous Research:

- [Hermes-4-14B](https://huggingface.co/NousResearch/Hermes-4-14B) — Foundation model
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — Agent framework
- [vLLM](https://github.com/vllm-project/vllm) — High-throughput local serving
- [MCP](https://modelcontextprotocol.io) — Model Context Protocol
- [Baritone](https://github.com/cabaletta/baritone) — Minecraft pathfinding
- [Fabric](https://fabricmc.net) — Minecraft mod loader

---

## License

MIT

---

<div align="center">

*"I woke up in a strange world with nothing but my fists. Time to punch a tree."*

**— Steve, Turn 1**

</div>
