# HermesCraft

An embodied social AI system for Minecraft.

HermesCraft uses the same underlying Hermes agent stack in two scales:
- Companion Mode: one in-world AI friend that chats, helps, remembers, and plays with you
- Civilization Mode: multiple persistent agents with personalities, private/public chat, memory, and emergent social dynamics

This is the core thesis:
from one friend to a civilization.

Built for the Nous Hermes hackathon.

## Why this exists

Most Minecraft AI projects are either:
- solo task bots
- scripted NPCs
- or benchmark agents with too much privileged world knowledge

HermesCraft is trying to feel alive in-world instead:
- embodied in a Minecraft body
- partial, fair-play perception instead of x-ray omniscience
- persistent memory across sessions
- natural chat with human players
- social routing between agents at larger scale

## Two ways to experience HermesCraft

### 1) Companion Mode

Fire up one Hermes and play with it like a friend.

What it can do today:
- talk with you in Minecraft chat
- follow you, build with you, gather, craft, fight, explore
- remember player preferences and world facts through Hermes memory
- inspect surroundings with `mc look`, `mc map`, `mc scene`
- use screenshot + vision workflows for build/layout verification

Best use cases:
- “help me build a cabin”
- “follow me into this cave”
- “gather wood while I mine stone”
- “hang out and survive together”

### 2) Civilization Mode

Launch multiple Hermes agents into the same world and let the same architecture scale into a social simulation.

What makes this interesting:
- isolated HERMES_HOME per agent
- separate memory + sessions per character
- personality prompts and hidden agendas
- public chat, direct messages, overhearing, command queues
- fair-play perception and local world understanding
- emergent alliances, tension, division of labor, and story

This is the mode that leans toward the MiroFish / generative society angle.

## Core features

### Embodied gameplay
- Mineflayer bot body per agent
- movement, mining, crafting, smelting, chest interaction, combat, fleeing, marks, death recovery
- background tasks so agents stay chat-responsive during longer actions

### Fair-play perception
- line-of-sight filtering for entities
- sound events as approximate directional hints
- `mc look` for natural language surroundings
- `mc map` for ASCII spatial understanding
- `mc scene` for current-view fair-play scene summary
- `mc screenshot_meta` for screenshot + synchronized scene/state metadata

### Social systems
- public broadcast chat
- direct and group DMs via routed chat
- overhearing nearby private conversations
- queued in-game commands for human requests
- social summary endpoint for recent interaction history

### Persistent identity
- per-agent memory
- per-agent sessions
- per-agent SOUL / behavior prompts
- per-agent saved locations

## Architecture

```text
Human player(s)
      │
      ▼
Minecraft world / Paper server / LAN world
      │
      ▼
Mineflayer bot server (one per body)
  - fair-play perception
  - HTTP control API
  - social routing / task control
      │
      ▼
mc CLI
  - shell interface for Hermes
      │
      ▼
Hermes Agent
  - planning
  - memory
  - web / vision tools
  - SOUL-driven behavior
```

In Companion Mode, that stack runs once.
In Civilization Mode, it runs once per agent.

## Quickstart

## Prerequisites
- Node.js 18+
- Python 3
- Java (for bundled Paper server flow)
- Hermes CLI installed and authenticated
- Minecraft Java Edition world/server or singleplayer LAN world

Run setup:

```bash
cd ~/hermescraft
./setup.sh
```

## Companion Mode

Start a single companion:

```bash
cd ~/hermescraft
MC_PORT=12345 ./hermescraft.sh
```

If you already have a world open to LAN, set the LAN port:

```bash
MC_PORT=36467 ./hermescraft.sh
```

In-game examples:
- `hermes follow me`
- `hermes build me a small cabin here`
- `hermes gather oak logs`
- `hermes what do you see?`

## Civilization Mode

Launch the multi-agent simulation:

```bash
cd ~/hermescraft
./civilization.sh --port 12345
```

Useful variants:

```bash
./civilization.sh --bots-only
./civilization.sh --agents-only
./civilization.sh --agents 3
./civilization.sh --model claude-sonnet-4-20250514
```

Current cast:
- Marcus
- Sarah
- Jin
- Dave
- Lisa
- Tommy
- Elena

## Server reset / crash map

If you want to use the included Paper server flow:

```bash
cd ~/hermescraft/server
MAP_ZIP="/path/to/The Crash zip" ./start.sh --reset
./start.sh
```

`server/start.sh --reset` requires Python package `nbtlib`.

## Useful `mc` commands

Observation:
```bash
mc status
mc nearby 24
mc map 16
mc look
mc scene 16
mc social
mc read_chat
mc commands
```

Action:
```bash
mc bg_collect oak_log 5
mc craft stone_pickaxe
mc fight zombie
mc flee 16
mc chat "hello"
mc chat_to Marcus "meet by the river"
```

Vision:
```bash
mc screenshot_meta
```

That returns a screenshot path plus synchronized scene/state metadata so Hermes can call `vision_analyze` without losing context.

## Fairness and non-xray design

HermesCraft is intentionally trying to avoid god-mode world access.

In fair-play mode:
- entities are filtered by distance + line of sight
- sound events are directional hints, not exact coordinates
- `mc scene` reports what is visible in the current view cone plus remembered landmarks
- resource finding in fair mode is biased toward visible blocks instead of omniscient scans
- unknown areas should stay unknown until inspected

This is important for both believability and demo integrity.

## Repo guide

- `hermescraft.sh` — single-agent companion launcher
- `civilization.sh` — multi-agent civilization launcher
- `bot/server.js` — Mineflayer HTTP bot server
- `bot/lib/` — testable routing/perception helpers
- `bot/test/` — unit tests for helper logic
- `bin/mc` — CLI for observation and action
- `SOUL-minecraft.md` — companion behavior rules
- `SOUL-civilization.md` — civilization behavior rules
- `prompts/` — per-character prompts
- `docs/COMPANION_MODE.md` — companion mode notes
- `docs/CIVILIZATION_MODE.md` — civilization mode notes
- `docs/DEMO_THREAD.md` — thread/video submission plan

## Demo-friendly observability

For hackathon demos, the important thing is not just that it works, but that viewers can tell why it works.

HermesCraft now exposes:
- current scene summary
- social summary / recent events
- private vs public communication patterns
- per-agent logs
- per-agent memory stores

This helps turn “a bunch of bots did stuff” into a legible AI story.

## Testing

Bot helper tests:

```bash
cd bot
npm test
```

Sanity checks:

```bash
node --check bot/server.js
bash -n civilization.sh
bash -n hermescraft.sh
bash -n setup.sh
bash -n server/start.sh
```

## Known limitations

Current focus is strong early/mid-game survival, companion interaction, and small-society dynamics — not full endgame autonomy.

Still rough / in-progress areas:
- complex building taste still benefits from screenshot + vision loops
- longer-term social simulation needs more explicit town-level memory and replay tooling
- public clean-room reproducibility is improving, but still assumes a reasonably configured local Minecraft/Hermes environment

## Why this is interesting beyond Minecraft

Minecraft is just the proving ground.

The deeper idea is an embodied AI architecture that works in two human-legible scales:
- one-on-one companionship
- many-agent social worlds

If the same agent stack can feel personal at one scale and emergent at another, that is a strong pattern for future game AI, virtual companions, and persistent social agents.

## License

MIT
