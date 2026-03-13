<p align="center">
  <img src="hermescraft.png" alt="HermesCraft" width="100%">
</p>

# HermesCraft

An autonomous AI agent that plays Minecraft survival mode, powered by [Nous Hermes](https://nousresearch.com/) running locally via vLLM. The agent controls a real Minecraft client through a custom Fabric mod, working through 7 phases to defeat the Ender Dragon — all without human input.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GPU Server (48GB+ VRAM recommended)                            │
│                                                                 │
│  ┌──────────────┐                   ┌──────────────────┐       │
│  │   vLLM        │                   │  MC Client       │       │
│  │  Hermes 4.3   │                   │  1.21.1 Fabric   │       │
│  │  36B AWQ      │                   │  + HermesBridge  │       │
│  │  :8000        │                   │  + Baritone      │       │
│  └──────┬───────┘                   └────────┬─────────┘       │
│         │                                     │                 │
│         │  OpenAI-compatible API              │ HTTP :3001      │
│         │                                     │                 │
│  ┌──────┴─────────────────────────────────────┴─────────┐      │
│  │                    Agent (Node.js)                     │      │
│  │                                                       │      │
│  │   every 3s:  OBSERVE  →  THINK  →  ACT               │      │
│  │              (mod API)   (vLLM)    (mod API)          │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌──────────────┐                                              │
│  │  OBS Studio   │ ── RTMP ──→  Any streaming platform         │
│  │  (optional)   │              (Twitch, YouTube, etc.)         │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **GPU**: 48GB+ VRAM (A6000, A100, etc.) for the 36B model, or 24GB for smaller Hermes variants
- **Minecraft**: Java Edition 1.21.1 with a server you can connect to (local or remote)
- **Fabric**: 1.21.1 Fabric loader + Baritone installed on the client
- **Node.js**: 20+
- **Python**: 3.10+ (for vLLM)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/hermescraft/hermescraft.git
cd hermescraft
npm install

# 2. Build the HermesBridge mod (Fabric 1.21.1)
cd mod && ./gradlew build
cp build/libs/hermesbridge-*.jar ~/.minecraft/mods/
cd ..

# 3. Start vLLM with Hermes
vllm serve NousResearch/Hermes-4.3-Llama-3.3-36B-AWQ \
  --port 8000 --max-model-len 8192 --quantization awq \
  --gpu-memory-utilization 0.6 \
  --enable-auto-tool-choice --tool-call-parser hermes

# 4. Launch Minecraft client with Fabric + HermesBridge + Baritone
#    Connect to any 1.21.1 survival server

# 5. Configure environment
cp .env.example .env
# Edit .env if vLLM or mod are on non-default ports

# 6. Start the agent
node agent/index.js
```

If you're running on RunPod, see `runpod/setup.sh` and `runpod/start-all.sh` for automated provisioning.

## Components

### Agent (`agent/`)

The brain. A Node.js loop that runs every 3 seconds:

1. **Observe** -- Calls HermesBridge mod API to get player state (position, health, hunger, inventory, nearby entities, blocks)
2. **Think** -- Sends observation + conversation history + phase goals to Hermes via vLLM. The model reasons about what to do next.
3. **Act** -- Parses the model's tool call into a game action (move, mine, craft, attack, place, etc.) and sends it to the mod API.

The agent tracks which phase the run is in and adjusts prompts accordingly. Deaths trigger strategy reassessment. Getting stuck for multiple ticks triggers replanning.

### HermesBridge Mod (`mod/`)

A Fabric 1.21.1 mod that exposes the game state and accepts commands over HTTP (port 3001).

Endpoints:
- `GET /health` -- Mod status
- `GET /state` -- Full game state snapshot (position, health, inventory, nearby blocks/entities)
- `POST /action` -- Execute a game action (move, mine, place, craft, attack, use, look, chat)
- `GET /recipes?item=X` -- Recipe lookup for a specific item

The mod integrates with Baritone for pathfinding -- the agent can issue high-level navigation commands like "go to coordinates" or "mine 10 iron ore" and Baritone handles the pathing.

### RunPod Scripts (`runpod/`)

Optional scripts for running on RunPod Desktop pods:

- `setup.sh` -- One-time pod provisioning (Java 21, Node 20, vLLM, OBS, Fabric installer)
- `start-all.sh` -- Launch vLLM, MC server, agent
- `stop-all.sh` -- Graceful shutdown of all services
- `health-check.sh` -- Verify GPU, vLLM, mod, agent are running

### Config (`config/`)

- `hermes-profile.json` -- Agent personality, goals, and the 7-phase progression from first night to dragon fight
- `obs-scene.json` -- OBS scene layout reference (terminal on left, Minecraft on right, logo overlay)

## How It Works

The core loop is **observe-think-act**, running every 3 seconds:

```
OBSERVE: Get game state from HermesBridge mod
  → position, health, hunger, inventory, nearby blocks, entities, time of day

THINK: Send to Hermes via vLLM (native tool calling)
  → system prompt with personality + current phase goals
  → recent observation history (sliding window)
  → model outputs reasoning + tool call

ACT: Execute tool call via mod API
  → move, mine, craft, place, attack, use items, look around
  → Baritone handles complex pathfinding
```

The agent maintains a conversation history so the model has context about what it has been doing. Phase transitions happen automatically when objectives are met (e.g., having iron tools triggers advancement from phase 2 to phase 3).

## The 7 Phases

| # | Phase | Key Objectives |
|---|-------|---------------|
| 1 | First Night | Shelter, wooden tools, furnace, food |
| 2 | Iron Age | 20+ iron, full iron gear, shield, base |
| 3 | Diamonds | Mine to Y=-59, 11+ diamonds, diamond gear |
| 4 | Nether | Obsidian, build portal, enter Nether |
| 5 | Blaze Rods | Find fortress, kill blazes, 7+ rods |
| 6 | Ender Pearls | Hunt endermen, 12+ pearls, craft Eyes of Ender |
| 7 | Dragon Fight | Find stronghold, enter End, kill the dragon |

## Streaming (Optional)

You can livestream the agent's gameplay with OBS. The recommended layout is two panels side by side:
- **Left (40%)** -- Terminal running the agent, showing LLM reasoning in real time
- **Right (60%)** -- Minecraft client first-person view

Setup:
1. Open OBS Studio
2. Add window captures for terminal and Minecraft
3. Set output to Custom RTMP with your platform's stream URL and key
4. Start streaming

Use `runpod/stream-layout.sh` to auto-arrange windows if running on a virtual desktop.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| LLM | Nous Hermes 4.3 Llama 3.3 36B (AWQ quantized) |
| Inference | vLLM with OpenAI-compatible API |
| Agent | Node.js |
| Game | Minecraft 1.21.1 (Java Edition) |
| Mod loader | Fabric |
| Bridge mod | Custom HermesBridge (Java, Fabric API) |
| Pathfinding | Baritone |
| Streaming | OBS Studio via RTMP (optional) |

## Project Structure

```
hermescraft/
  agent/          # Node.js agent (observe-think-act loop)
  mod/            # HermesBridge Fabric mod (Java)
  config/         # Agent profile, OBS scene config
  minecraft/      # Server properties template
  runpod/         # RunPod provisioning and lifecycle scripts
  token/          # Token metadata and branding assets
  .env.example    # Environment variables template
  package.json    # Node.js dependencies
```

## License

MIT
