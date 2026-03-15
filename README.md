# ⚡ HermesCraft

### Embodied AI Companion for Minecraft

> MiroFish builds parallel worlds of AI agents to predict outcomes. We put the agent IN the world.

HermesCraft connects [Hermes Agent](https://github.com/NousResearch/hermes-agent) to Minecraft — not as a scripted bot, but as a **thinking, learning, remembering companion**. It joins your world as a real player, chats with you naturally, follows complex instructions, mines resources, builds structures, fights mobs, explores — and gets better over time. All through natural language in Minecraft chat.

This is the foundation for **persistent, embodied AI companions** in virtual worlds. Today it's one agent building a cabin with you. The architecture supports hundreds of agents building civilizations.

## ✨ Features

- 🧠 **AI Brain, Not a Script** — Every decision made by an LLM. No pattern matching, no hardcoded responses
- 💾 **Persistent Memory** — Teach it once ("use birch logs, not oak"), it remembers forever across sessions
- 👁 **Vision** — Takes screenshots of the game, analyzes builds, self-corrects
- 🔄 **Async Multitasking** — Mines in the background while chatting with you. Interrupts tasks when you need it
- ⚔️ **Survival** — Fights mobs, eats food, tracks deaths, recovers items
- 🏗️ **Builds With Taste** — Surveys terrain, plans layouts, uses varied materials
- 🌐 **Web-Connected** — Looks up crafting recipes, building ideas, anything online
- 🤝 **Multi-Agent Ready** — Run multiple AI personalities cooperating in one world
- 🔧 **Extensible** — HTTP API + CLI + AI agent pattern. Add actions, skills, personalities

## Quick Start

```bash
git clone https://github.com/bigph00t/hermescraft.git
cd hermescraft
./setup.sh

# Open Minecraft, start a world, Open to LAN (note the port)
MC_PORT=35901 ./hermescraft.sh
```

Then talk to the AI in Minecraft chat:
```
hermes follow me
hermes build a cute log cabin on this hillside
hermes go mine some iron
hermes stop that, there's a creeper behind you!
hermes what's the weather in tokyo?
```

Every message you send is processed by the AI brain. It decides what to do, plans multi-step tasks, adapts when you change your mind, and learns from your feedback.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    HERMES AGENT                      │
│         (LLM brain — Claude, GPT, or local)          │
│                                                      │
│  • Persistent memory across sessions                 │
│  • Web search, vision analysis, tool use             │
│  • Minecraft skills library                          │
│  • SOUL personality defining behavior                │
│                                                      │
│  Runs `mc` CLI commands via terminal                 │
└──────────────────────┬──────────────────────────────┘
                       │ mc status, mc collect, mc chat...
                       ▼
┌─────────────────────────────────────────────────────┐
│                    mc CLI (bin/mc)                    │
│         ~35 commands, human-readable output           │
│         Translates commands → HTTP API calls          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (localhost:3001)
                       ▼
┌─────────────────────────────────────────────────────┐
│              BOT SERVER (bot/server.js)               │
│                                                      │
│  Mineflayer bot — the body.                          │
│  No decision-making. Just eyes, hands, legs.         │
│                                                      │
│  • 8 GET endpoints (observe state)                   │
│  • 24 POST /action/* endpoints (do things)           │
│  • Background task system (/task/*)                  │
│  • Chat queue for AI processing                      │
│  • State piggybacking (chat + task status            │
│    included in every response)                       │
└──────────────────────┬──────────────────────────────┘
                       │ Mineflayer protocol
                       ▼
┌─────────────────────────────────────────────────────┐
│              MINECRAFT SERVER                        │
│    Any Java Edition (1.8–1.21+) — LAN or dedicated   │
└─────────────────────────────────────────────────────┘
```

**Key design principle:** The bot server is a dumb body. The AI agent is the brain. All decisions — what to say, where to go, what to build, when to fight or flee — are made by the LLM. This means the agent can handle anything you throw at it, not just pre-programmed commands.

## How It Works

1. **You talk** in Minecraft chat: `hermes build a cabin here`
2. **Bot server** queues the message for the AI
3. **Hermes Agent** sees it via `mc commands`, decides how to respond
4. **Agent plans**: surveys terrain, gathers materials, calculates placement
5. **Agent executes**: runs `mc collect`, `mc craft`, `mc place` commands
6. **Agent checks in**: reads your chat between actions, adapts if you give feedback
7. **Agent learns**: saves your preferences to persistent memory for next time

## Usage

```bash
# Play together (companion mode — AI chats and plays with you)
MC_PORT=35901 ./hermescraft.sh

# Play with a specific goal
MC_PORT=35901 ./hermescraft.sh "survive the first night and build a shelter"
MC_PORT=35901 ./hermescraft.sh "find diamonds"

# Just start the bot server (control manually via mc CLI)
MC_PORT=35901 ./hermescraft.sh --bot-only

# Then control the bot directly
mc status                    # see game state
mc collect oak_log 10        # mine 10 oak logs
mc craft wooden_pickaxe      # craft an item
mc chat "hello world"        # send chat message
mc bg_collect iron_ore 20    # mine in background (non-blocking)
mc task                      # check background task progress
mc screenshot                # take a screenshot for AI vision
```

## mc CLI Reference

```
OBSERVE:
  mc status              Full state — health, pos, inventory, nearby, chat
  mc inventory           Categorized inventory
  mc nearby [radius]     Blocks + entities around you
  mc read_chat [count]   Recent player messages
  mc commands            Queued requests from player
  mc health              Quick connection check

MOVE:
  mc goto X Y Z          Navigate to position
  mc goto_near X Y Z     Navigate near position
  mc follow PLAYER       Follow a player
  mc look_at X Y Z       Look at position
  mc stop                Stop all movement/actions

MINE:
  mc collect BLOCK [N]   Find + mine blocks (auto-pickup)
  mc dig X Y Z           Break specific block
  mc pickup              Grab nearby item drops
  mc find_blocks BLOCK   Search for block locations
  mc find_entities TYPE  Find mobs/players nearby

CRAFT:
  mc craft ITEM [N]      Craft item (auto-finds crafting table)
  mc recipes ITEM        Look up crafting recipe
  mc smelt INPUT [fuel]  Smelt in furnace

COMBAT:
  mc attack [target]     Attack nearest mob (or specific type)
  mc eat                 Eat best food in inventory
  mc equip ITEM          Equip tool/weapon/armor

BUILD:
  mc place BLOCK X Y Z   Place a block at position
  mc interact X Y Z      Right-click block (chests, doors, etc.)

SOCIAL:
  mc chat "message"      Send chat message in game

BACKGROUND TASKS (non-blocking):
  mc bg_collect BLOCK [N]  Mine in background — returns instantly
  mc bg_goto X Y Z         Navigate in background
  mc task                  Check background task status
  mc cancel                Cancel running background task

VISION:
  mc screenshot          Capture Minecraft window (returns file path)

UTILITY:
  mc use                 Use held item
  mc toss ITEM           Drop item
  mc sleep               Sleep in nearby bed
  mc wait [seconds]      Wait N seconds
  mc connect             (Re)connect bot to server

FLAGS:
  --json                 Raw JSON output (for scripting)
```

## In-Game Chat

Talk to the AI by typing in Minecraft chat. Start your message with "hermes":

```
hermes follow me                       → AI follows you
hermes build a house here              → AI surveys, gathers, builds
hermes mine 30 cobblestone             → AI mines in background, stays responsive
hermes stop, come here                 → AI cancels current task, comes to you
hermes don't use dirt for walls        → AI saves lesson to memory
hermes what's the recipe for a shield? → AI looks it up (web search)
```

Every message goes to the AI brain. No pre-programmed responses. The AI decides what to do based on context, inventory, surroundings, and your history together.

## Learning & Memory

HermesCraft uses [Hermes Agent's persistent memory](https://github.com/NousResearch/hermes-agent) to learn from you:

- **Building preferences**: "Use birch logs for frames" → remembered next session
- **Gameplay lessons**: "Creepers explode, always run" → never forgets
- **Location memory**: Saves base coords, mine locations, death spots
- **Player profile**: Learns your name, play style, preferences

Memory persists across sessions and even across platforms (teach it in Minecraft, it remembers in Telegram).

## Configuration

```bash
# Environment variables
MC_HOST=localhost      # Minecraft server host
MC_PORT=25565          # Server port (or LAN port)
MC_USERNAME=HermesBot  # Bot username in-game
API_PORT=3001          # Bot HTTP API port
MC_AUTH=offline        # Auth: offline or microsoft
```

### Server Requirements
- Minecraft Java Edition (1.8–1.21+)
- For LAN: Open to LAN in pause menu, note the port
- For dedicated servers: `online-mode=false` in server.properties (or use MS auth)

## Project Structure

```
hermescraft/
├── hermescraft.sh          # Main launcher (starts bot + Hermes Agent)
├── setup.sh                # First-time setup (npm install, CLI, skills)
├── play.sh                 # Alias for hermescraft.sh
├── SOUL-minecraft.md       # AI behavior/personality definition
├── bot/
│   ├── server.js           # Mineflayer bot + HTTP API (the body)
│   └── package.json
├── bin/
│   └── mc                  # CLI wrapper (~35 commands)
└── skills/
    ├── minecraft-survival.md
    ├── minecraft-combat.md
    ├── minecraft-building.md
    ├── minecraft-farming.md
    └── minecraft-navigation.md
```

## The Vision

HermesCraft is the **groundwork for embodied AI agents in virtual worlds**.

[MiroFish](https://github.com/666ghj/MiroFish) builds parallel digital worlds populated by thousands of AI agents with personalities, memory, and social dynamics — to predict real-world outcomes. [Project Sid](https://arxiv.org/abs/2411.10935) demonstrated 1000+ AI agents forming governments, economies, and religions in Minecraft. [Voyager](https://arxiv.org/abs/2305.16291) showed LLM-powered lifelong learning in Minecraft.

We're building the **open-source toolkit** that makes this accessible:

- **Game-agnostic architecture**: HTTP API + CLI + AI agent pattern works for any game with a bot API
- **Human-AI cooperation**: Designed for humans and AI playing together, not AI playing alone
- **Persistent learning**: Agents that accumulate knowledge and skills over time
- **Multi-agent ready**: Run multiple personalities — a builder, a miner, a guard — cooperating through in-game chat
- **Built on Hermes Agent**: Inherits persistent memory, web access, vision, 100+ tool integrations, multi-platform messaging

Today: one AI companion building a cabin with you.
Tomorrow: AI civilizations emerging in persistent virtual worlds.

## Requirements

- Node.js ≥ 18
- Python 3
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) (`pip install hermes-agent`)
- Minecraft Java Edition
- X11 display (for screenshot feature — `xdotool` + `scrot`)

## License

MIT
