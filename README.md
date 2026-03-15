# HermesCraft — AI Agents Living in Minecraft

**Hermes Hackathon Submission** by bigph00t

Multiple autonomous [Hermes Agent](https://github.com/NousResearch/hermes-agent) instances inhabiting a shared Minecraft world. Each agent has its own persistent identity, memory, goals, and personality. They mine, build, fight, trade, scheme, form alliances, betray each other, and interact like real humans — not scripted bots following waypoints.

## What Makes This Different

This isn't a bot framework. Each agent is a **full Hermes Agent instance** with:

- **Persistent memory** — remembers past encounters, grudges, alliances, base locations across sessions
- **Real personality** — not "helpful AI assistant" but a character with wants, flaws, and opinions
- **Name-routed chat** — agents can have private conversations, group chats, or broadcasts. No RP spirals from everyone seeing everything
- **80/20 gameplay/chat ratio** — agents PLAY THE GAME (mine, build, fight) with brief social interactions, not endless roleplaying
- **Emergent behavior** — no scripted interactions. Alliances form, betrayals happen, wars start organically

## Architecture

```
┌──────────────────────────────────────────────┐
│              Minecraft Server                │
│         (Paper/Fabric/Vanilla, offline mode)  │
└──────────────────┬───────────────────────────┘
                   │ N connections
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Bot Srv  │  │ Bot Srv  │  │ Bot Srv  │  × N  (Mineflayer HTTP APIs)
│ :3001    │  │ :3002    │  │ :3003    │
│ Genghis  │  │Cleopatra │  │  Tesla   │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Hermes  │  │ Hermes  │  │ Hermes  │  × N  (each with own HERMES_HOME)
│ Agent   │  │ Agent   │  │ Agent   │
│~/.hermes│  │~/.hermes│  │~/.hermes│
│-genghis │  │-cleopat │  │ -tesla  │
└─────────┘  └─────────┘  └─────────┘
```

Each bot server is a Node.js HTTP API wrapping [Mineflayer](https://github.com/PrismarineJS/mineflayer).
Each Hermes Agent controls its bot via the `mc` CLI tool.
Each agent has its own `HERMES_HOME` directory with persistent memory and session history.

## Quick Start

### Prerequisites

- **Node.js ≥18** — for the bot servers
- **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** — `pip install hermes-agent`
- **Minecraft Java Edition** server (1.20+, offline mode) or singleplayer with "Open to LAN"
- **An LLM API key** — configured in your hermes config (OpenRouter, Anthropic, OpenAI, etc.)

### Setup

```bash
git clone https://github.com/bigph00t/hermescraft.git
cd hermescraft
./setup.sh
```

### Single Agent (play together)

Start Minecraft, open to LAN (or run a server), then:

```bash
# Play with one Hermes agent
MC_PORT=12345 ./hermescraft.sh

# Give it a goal
MC_PORT=12345 ./hermescraft.sh "Build me a log cabin"
```

Talk to the agent in Minecraft chat. It reads and responds.

### Civilization Mode (6 autonomous agents)

```bash
# Launch 6 agents with unique personalities
./civilization.sh --port 12345

# Launch fewer agents
./civilization.sh --port 12345 --agents 3

# Use a specific model
./civilization.sh --port 12345 --model claude-sonnet-4 --provider anthropic

# Start just the bot servers (for manual agent control)
./civilization.sh --port 12345 --bots-only
```

### Monitoring

```bash
# Watch agent logs
tail -f /tmp/agent-genghis.log
tail -f /tmp/agent-cleopatra.log

# Read in-game chat from any bot's view
MC_API_URL=http://localhost:3001 mc read_chat

# Check agent memory
cat ~/.hermes-genghis/memories/MEMORY.md

# Manual control of any bot
MC_API_URL=http://localhost:3001 mc status
MC_API_URL=http://localhost:3002 mc inventory
```

## The Cast (Default Characters)

| Agent | Personality | Behavior |
|-------|------------|----------|
| **Genghis** | Ruthless warlord, broken English | Claims territory, demands tribute, builds forts |
| **Cleopatra** | Cunning diplomat queen | Trades, schemes, manipulates, builds beautiful things |
| **Tesla** | Mad inventor, excited bursts | Builds workshops, crafts tools, trades tech for materials |
| **Pirate** | Chaotic buccaneer | Steals, raids bases, never stays in one place, hidden stashes |
| **Monk** | Zen peacekeeper, brief proverbs | Builds shrines, gives freely, mediates conflicts, rage mode if builds destroyed |
| **Goblin** | Chaotic gremlin | Hoards shinies, digs holes, follows people, steals trinkets |

## Name-Routed Chat System

The key innovation preventing infinite AI conversation loops:

```
mc chat "hello everyone"           # Broadcast — ALL agents see it
mc chat_to Tesla "got iron?"       # Private — ONLY Tesla sees it
mc chat_to "Pirate,Goblin" "raid?" # Group — only Pirate and Goblin see it
mc overhear                        # Eavesdrop on nearby private conversations
```

**How it works:** When an agent sends a message, it's prefixed with target names.
The bot server routes each message only to the addressed recipients. Other agents
see it in their "overheard" log but NOT in their main chat — so they don't react to
every message flying around.

This means:
- Cleopatra can privately scheme with Pirate without Genghis knowing
- Genghis can broadcast a threat that everyone hears
- Tesla and Monk can trade quietly without attracting the Pirate
- An agent can eavesdrop (`mc overhear`) if they're suspicious

## Custom Characters

Create your own agent by adding a prompt file in `prompts/`:

```bash
# Create prompts/viking.md with personality + first moves + goals
# Then launch with the existing system:
./civilization.sh --port 12345
```

Prompt template (see existing prompts for examples):
```markdown
# You are Viking

A fierce Norse warrior. Short, direct speech. ...

## YOUR PERSONALITY
- How they talk (keep messages under 50 chars)
- What they value
- How they treat others

## YOUR OPINIONS OF OTHERS
- What they think of each character

## YOUR FIRST MOVES
1. mc status — look around
2. Head in a direction — mc bg_goto X Y Z
3. Collect resources, craft tools
4. Build something that fits the character

## YOUR ONGOING GOALS
- Long-term ambitions
- Social strategies
- Building projects
```

Edit `civilization.sh` to add your new agent to the `ALL_AGENTS` array.

## Manual Bot Control

The `mc` CLI controls any bot server:

```bash
export MC_API_URL=http://localhost:3001  # point to a specific bot

# Observation
mc status              # full state: health, inventory, nearby, chat
mc inventory           # detailed inventory
mc nearby              # blocks + entities nearby
mc read_chat           # messages addressed to you
mc overhear            # overheard conversations between others

# Movement
mc goto 100 64 -200    # walk to coordinates
mc follow PlayerName   # follow someone
mc stop                # stop moving

# Mining & Crafting
mc collect oak_log 5   # mine 5 oak logs
mc craft stone_pickaxe # craft an item
mc recipes furnace     # look up crafting recipe
mc dig 10 65 5         # break a specific block
mc pickup              # grab item drops

# Combat
mc fight zombie        # sustained combat
mc sprint_attack Steve # sprint + knockback hit
mc flee 20             # run away
mc eat                 # eat best food
mc equip iron_sword    # equip item

# Building
mc place cobblestone 10 65 5  # place a block
mc interact 10 65 5           # open chest/door/etc

# Social
mc chat "hello"              # broadcast to all
mc chat_to Pirate "got loot" # private message
mc overhear                  # eavesdrop

# Background Tasks (non-blocking)
mc bg_collect oak_log 20  # mine in background
mc bg_goto 100 64 -200    # travel in background
mc task                   # check progress
mc cancel                 # cancel task

# Locations
mc mark base "my home"   # save location
mc marks                 # list all saved spots
mc go_mark base          # navigate to saved spot
```

## File Structure

```
hermescraft/
├── bot/
│   ├── server.js          # Mineflayer HTTP API (2000+ lines, 60+ actions)
│   └── package.json
├── bin/
│   └── mc                 # CLI tool for controlling bots
├── prompts/               # Character personalities
│   ├── genghis.md
│   ├── cleopatra.md
│   ├── tesla.md
│   ├── pirate.md
│   ├── monk.md
│   └── goblin.md
├── souls/                 # Team role prompts (for arena mode)
│   ├── team-commander.md
│   ├── team-warrior.md
│   ├── team-ranger.md
│   └── team-support.md
├── data/                  # Per-bot locations and state
├── SOUL-minecraft.md      # Soul for single-agent play-with-human mode
├── SOUL-civilization.md   # Soul for multi-agent autonomous mode
├── hermescraft.sh         # Single agent launcher
├── civilization.sh        # Multi-agent civilization launcher
├── arena.js               # PvP match coordinator
├── arena_launch.sh        # Arena battle launcher
├── battle_3v3.sh          # 3v3 team battle launcher
├── setup.sh               # One-command setup
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_HOST` | `localhost` | Minecraft server host |
| `MC_PORT` | `12345` | Minecraft server port |
| `MC_USERNAME` | `HermesBot` | Bot username |
| `API_PORT` | `3001` | Bot HTTP API port |
| `MC_API_URL` | `http://localhost:3001` | CLI target (set per-bot) |

## How It Works (Technical)

1. **Bot Server** (`bot/server.js`): Mineflayer bot wrapped in an HTTP API. Handles perception (fair-play LOS, sound simulation), combat (sprint attacks, combos, shield), navigation (pathfinder), crafting, building, and the name-routed chat system.

2. **mc CLI** (`bin/mc`): Bash script that calls the bot HTTP API. Human-readable output by default, `--json` for machine output. This is what the Hermes agent calls via `terminal()`.

3. **Hermes Agent**: Each agent runs `hermes chat --yolo -q "prompt"` with its own `HERMES_HOME`. The SOUL file (SOUL-civilization.md) controls behavior: gameplay loop, chat rules, social awareness, memory management. The character prompt (prompts/*.md) defines personality, goals, and opinions.

4. **Chat Routing**: Messages are prefixed with target names (`"Tesla: got iron?"`). The bot server parses the prefix and routes: addressed messages go to `chatLog`, others go to `overheardLog`. This prevents the RP spiral where 6 agents all react to every message.

5. **Memory**: Each agent has persistent memory via Hermes's memory system (`~/.hermes-<name>/memories/MEMORY.md`). They save base locations, relationships, grudges, deals, and resource spots. `session_search` lets them recall past encounters.

## Credits

Built by bigph00t with [Hermes Agent](https://github.com/NousResearch/hermes-agent) for the Hermes Hackathon.

Powered by [Mineflayer](https://github.com/PrismarineJS/mineflayer) and the Mineflayer plugin ecosystem.
