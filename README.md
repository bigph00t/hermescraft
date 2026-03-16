# HermesCraft

HermesCraft brings Hermes agents into Minecraft as embodied players.

A Hermes agent can join your world, chat with you in-game, follow you, gather resources, build, fight, remember what happened, and learn your preferences over time. The same architecture also scales to multi-agent worlds, where many Hermes agents share the same server, privately message each other, and gradually become characters in the world.

Core idea:
- one agent feels like a companion
- many agents can make a world feel alive

Built for the Nous Hermes hackathon.

## What HermesCraft actually is

This is not a fake NPC framework and not a separate custom agent runtime.

Each character is a real Hermes agent with:
- its own `HERMES_HOME`
- its own memory and sessions
- its own SOUL / prompt
- its own Minecraft bot body
- the normal Hermes tool stack
- the Minecraft `mc` interface for acting in-world

Architecture:

```text
Hermes Agent
  -> terminal/tool use
  -> mc CLI
  -> bot/server.js HTTP API
  -> Mineflayer bot body
  -> Minecraft world
```

That is true for one companion and for multi-agent worlds.

## Why this is interesting

Most Minecraft AI projects are one of these:
- benchmark agents
- scripted NPCs
- bots with too much privileged world knowledge

HermesCraft is trying to be something else:
- embodied instead of disembodied
- fair instead of x-ray omniscient
- persistent instead of sessionless
- social instead of purely task-oriented
- usable by normal players in a real Minecraft world

Long term, this points toward MiroFish-style agent societies — but in a physical sandbox world with terrain, resources, danger, geography, and human players.

## Main modes

### 1) Companion Mode

Run one Hermes agent as an in-world Minecraft friend.

What it can do:
- chat with you in Minecraft
- follow you around
- help gather resources
- help build
- scout the area
- fight / flee / survive with you
- remember what happened across sessions
- adapt to your preferences over time

Good use cases:
- "follow me"
- "help me build a house"
- "gather wood while I mine stone"
- "come explore this cave with me"

### 2) Civilization Mode

Run multiple Hermes agents in the same world.

What makes it interesting:
- separate memory and identity per character
- public chat, private DMs, overhearing, commands
- fair-play perception and local world understanding
- emergent routines, alliances, tension, division of labor
- the world starts to feel inhabited

### 3) Landfolk Mode

A small 5-character cast for a player's LAN world.

Current cast:
- Steve — your normal Minecraft buddy
- Reed — wants to build a fishing shack on the water
- Moss — makes paths, gardens, and cozy green spaces
- Flint — gravitates toward caves, stone, and mining routes
- Ember — builds hearth/forge energy around camp

This is meant to make a normal personal world feel more alive without going all the way to a full civilization sim.

Important: the most reliable way to run Landfolk right now is direct per-agent Hermes launches after the bot bodies are connected. Convenience wrappers are still secondary.

## Core features

### Embodied gameplay
- movement and pathfinding
- mining and collection
- crafting and smelting
- chest interaction
- combat / fleeing
- location marking and return
- background tasks so agents can keep checking chat

### Fair-play perception
- line-of-sight filtering for entities
- directional sound hints
- `mc look` for natural-language surroundings
- `mc map` for ASCII spatial understanding
- `mc scene` for current-view fair-play scene summary
- `mc screenshot_meta` for screenshot + synchronized scene/state metadata

### Social systems
- public chat
- direct and group private messages
- overhearing nearby private conversation
- queued in-game commands from human players
- social summary / recent interaction state

### Persistent identity
- per-agent memory
- per-agent sessions
- per-agent prompts / SOUL
- per-agent saved locations

## What is stable vs experimental

Most stable path today:
- one companion via `hermescraft.sh`
- direct Hermes-per-agent launches when you want total control

More experimental / still being hardened:
- convenience wrappers that spawn lots of terminals automatically
- more complex multi-agent launchers

If you want reliability, use the direct commands shown below.

## Prerequisites

- Node.js 18+
- Python 3
- Hermes CLI installed and authenticated
- Minecraft Java Edition
- optional: Java if you want to use the included Paper server flow

Setup:

```bash
cd ~/hermescraft
./setup.sh
```

## Quickstart

### Companion Mode

If you already have a world open to LAN:

```bash
cd ~/hermescraft
MC_PORT=<LAN_PORT> ./hermescraft.sh
```

Examples in chat:
- `hermes follow me`
- `hermes help me build here`
- `hermes gather oak logs`
- `hermes what do you see?`

### Civilization Mode

```bash
cd ~/hermescraft
./civilization.sh --port <PORT>
```

### Landfolk Mode

Most reliable path:
1. start the bot bodies
2. launch each Hermes brain directly

Start the bot bodies:

```bash
cd ~/hermescraft
./scripts/run-landfolk-bots.sh <LAN_PORT>
```

Then launch each Hermes brain in its own terminal.

## Reliable direct launch pattern

If a bot body is already connected on a given API port, this is the most reliable way to launch its Hermes brain:

```bash
cd ~/hermescraft
PROMPT="$(cat prompts/landfolk/steve.md)" && \
HERMES_HOME="$HOME/.hermes-landfolk-steve" \
MC_API_URL="http://localhost:3001" \
MC_USERNAME="Steve" \
hermes chat --yolo -q "$PROMPT" -m claude-sonnet-4-20250514 --provider anthropic
```

That same pattern works for any character by changing:
- prompt file
- HERMES_HOME
- MC_API_URL
- MC_USERNAME

## Useful `mc` commands

Observation:

```bash
mc status
mc inventory
mc nearby 24
mc look
mc map 24
mc scene 16
mc social
mc read_chat
mc commands
```

Action:

```bash
mc bg_collect oak_log 5
mc bg_goto 100 64 100
mc follow Steve
mc craft stone_pickaxe
mc fight zombie
mc flee 16
mc chat "hello"
mc whisper Reed "meet me by the shore"
```

Vision:

```bash
mc screenshot_meta
```

## Fairness and non-xray design

HermesCraft is intentionally trying to avoid god-mode behavior.

In fair-play mode:
- entities are filtered by line of sight and range
- sounds are directional hints rather than exact coordinates
- `mc scene` reports what is currently visible plus remembered nearby landmarks
- resource finding is biased toward visible blocks instead of omniscient scans
- agents are encouraged to admit uncertainty and reposition instead of bluffing

This matters for both believability and demo integrity.

## Repo guide

Important files:
- `hermescraft.sh` — single-agent companion launcher
- `civilization.sh` — multi-agent civilization launcher
- `scripts/run-landfolk-bots.sh` — start the 5 Landfolk bot bodies
- `scripts/run-landfolk-agent.sh` — launch one Landfolk Hermes brain cleanly
- `bot/server.js` — Mineflayer HTTP bot server
- `bot/lib/` — routing and perception helpers
- `bot/test/` — unit tests
- `bin/mc` — CLI for observation and action
- `SOUL-minecraft.md` — companion behavior
- `SOUL-civilization.md` — civilization behavior
- `SOUL-landfolk.md` — landfolk behavior
- `prompts/` — character prompts
- `docs/` — mode notes and hackathon/demo docs

## Testing

```bash
cd bot
npm test
```

Sanity checks:

```bash
node --check bot/server.js
bash -n civilization.sh
bash -n hermescraft.sh
bash -n landfolk.sh
bash -n setup.sh
bash -n server/start.sh
```

## Known limitations

Current focus is early/mid-game survival, companion play, and small-society behavior — not full endgame autonomy.

Still rough:
- automated batch launchers need more hardening than direct per-agent launches
- building taste still benefits from screenshot + vision loops
- longer-term social simulation needs stronger town-level memory / replay tooling
- public clean-room reproducibility still depends on a reasonably configured local Hermes + Minecraft environment

## Big picture

Minecraft is the proving ground, not the endpoint.

HermesCraft is really about whether the same Hermes architecture can work in two human-legible scales:
- personal companionship
- multi-agent worlds

If one agent can feel like a friend, and many agents can start to make a world feel inhabited, that is a strong foundation for persistent embodied AI systems.

## License

MIT
