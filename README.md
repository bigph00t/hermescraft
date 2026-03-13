# HermesCraft

An autonomous AI agent that plays Minecraft survival mode, powered by Nous Hermes 4.3 36B running locally on an A6000 GPU. The agent controls a real Minecraft client through a custom Fabric mod, working through 7 phases to defeat the Ender Dragon. The entire run is livestreamed to PumpFun.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  RunPod Desktop Pod — NVIDIA A6000 48GB                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   vLLM        │    │  MC Server   │    │  MC Client       │  │
│  │  Hermes 4.3   │    │  1.21.1      │    │  1.21.1 Fabric   │  │
│  │  36B AWQ      │    │  :25565      │    │  + HermesBridge  │  │
│  │  :8000        │    │              │    │  + Baritone      │  │
│  └──────┬───────┘    └──────────────┘    └────────┬─────────┘  │
│         │                                          │            │
│         │  OpenAI-compatible API                   │ HTTP :3001 │
│         │                                          │            │
│  ┌──────┴──────────────────────────────────────────┴─────────┐  │
│  │                    Agent (Node.js)                         │  │
│  │                                                           │  │
│  │   every 3s:  OBSERVE  →  THINK  →  ACT                   │  │
│  │              (mod API)   (vLLM)    (mod API)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐                                              │
│  │  OBS Studio   │ ── RTMP ──→  PumpFun Livestream             │
│  │  Terminal+MC  │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Provision a RunPod Desktop pod (A6000 48GB)
#    Use the "RunPod Desktop" template for noVNC access

# 2. Clone and setup
git clone https://github.com/bigphoot/hermescraft.git /opt/hermescraft
cd /opt/hermescraft
bash runpod/setup.sh

# 3. Install Minecraft server
bash minecraft/install-server.sh

# 4. Install the HermesBridge mod (Fabric 1.21.1)
cd mod && ./gradlew build
cp build/libs/hermesbridge-*.jar /opt/minecraft-client/mods/

# 5. Install agent dependencies
cd /opt/hermescraft && npm install

# 6. Configure environment
cp .env.example .env
# Edit .env with your stream key if streaming

# 7. Launch everything
bash runpod/start-all.sh

# 8. Check health
bash runpod/health-check.sh
```

## Components

### Agent (`agent/`)

The brain. A Node.js loop that runs every 3 seconds:

1. **Observe** -- Calls HermesBridge mod API to get player state (position, health, hunger, inventory, nearby entities, blocks)
2. **Think** -- Sends observation + conversation history + phase goals to Hermes 4.3 via vLLM. The model reasons about what to do next.
3. **Act** -- Parses the model's response into game actions (move, mine, craft, attack, place, etc.) and sends them to the mod API.

The agent tracks which phase the run is in and adjusts prompts accordingly. Deaths trigger strategy reassessment. Getting stuck for multiple ticks triggers replanning.

### HermesBridge Mod (`mod/`)

A Fabric 1.21.1 mod that exposes the game state and accepts commands over HTTP (port 3001).

Endpoints:
- `GET /health` -- Mod status
- `GET /observe` -- Full game state snapshot (position, health, inventory, nearby blocks/entities)
- `POST /action` -- Execute a game action (move, mine, place, craft, attack, use, look, chat)

The mod also integrates with Baritone for pathfinding -- the agent can issue high-level navigation commands like "go to coordinates" or "mine 10 iron ore" and Baritone handles the pathing.

### RunPod Scripts (`runpod/`)

- `setup.sh` -- One-time pod provisioning (Java 21, Node 20, vLLM, OBS, Fabric installer)
- `start-all.sh` -- Launch vLLM, MC server, agent (MC client and OBS started manually via noVNC)
- `stop-all.sh` -- Graceful shutdown of all services
- `health-check.sh` -- Verify GPU, vLLM, MC server, mod, agent, and OBS are running

### Config (`config/`)

- `hermes-profile.json` -- Agent personality, goals, and the 7-phase progression from first night to dragon fight
- `obs-scene.json` -- OBS scene layout reference (terminal on left, Minecraft on right, logo overlay)

### Token (`token/`)

- `metadata.json` -- PumpFun token metadata (name, symbol, description, links)
- `branding/` -- Logo and visual assets

## How It Works

The core loop is **observe-think-act**, running every 3 seconds:

```
OBSERVE: Get game state from HermesBridge mod
  → position, health, hunger, inventory, nearby blocks, entities, time of day

THINK: Send to Hermes 4.3 36B via vLLM
  → system prompt with personality + current phase goals
  → recent observation history (sliding window)
  → model outputs reasoning + next action(s)

ACT: Parse model response, send commands to mod
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

## Streaming Setup

The stream shows two panels side by side:
- **Left (40%)** -- Terminal running the agent, showing LLM reasoning in real time
- **Right (60%)** -- Minecraft client first-person view

Setup via noVNC desktop:
1. Open OBS Studio
2. Add window captures for terminal and Minecraft
3. Set output to Custom RTMP
4. Enter PumpFun RTMP URL and stream key from your livestream settings
5. Start streaming

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
| Streaming | OBS Studio via RTMP |
| GPU | NVIDIA A6000 48GB (RunPod) |
| Desktop | RunPod Desktop template (noVNC) |

## Cost Breakdown

| Resource | Cost |
|----------|------|
| RunPod A6000 48GB (Desktop pod) | ~$0.76/hr |
| 24hr run | ~$18.24 |
| PumpFun token launch | 0.02 SOL |

The A6000 48GB handles both model inference (~29GB VRAM for AWQ 36B at 60% utilization) and Minecraft rendering simultaneously.

## Project Structure

```
hermescraft/
  agent/          # Node.js agent (observe-think-act loop)
  mod/            # HermesBridge Fabric mod (Java)
  config/         # Agent profile, OBS scene config
  minecraft/      # Server properties, install script
  runpod/         # Provisioning and lifecycle scripts
  token/          # PumpFun token metadata and branding
  .env.example    # Environment variables template
  package.json    # Node.js dependencies
```

## License

MIT
