# HermesCraft

**Open-source framework for AI agents in Minecraft.**

Connect any LLM to Minecraft. Mine, craft, fight, build, explore — autonomously or cooperatively with humans. Run multiple agents in the same world.

Built on [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research.

---

## What Makes This Different

| Feature | HermesCraft | Mindcraft | Voyager |
|---------|-------------|-----------|---------|
| Framework | **Hermes Agent** | Custom | Custom |
| Multi-Agent | **Yes** | Limited | No |
| Sustained Combat | **Fight/flee with retreat** | Single hit | None |
| Death Recovery | **Navigate back + recover items** | None | None |
| Location Memory | **Mark/recall system** | None | None |
| Container Management | **Chest deposit/withdraw** | None | None |
| Stuck Detection | **Auto-cancel + recovery** | None | None |
| Cooperative Play | **Chat + follow + share** | Solo focus | Solo |
| LLM Support | Any (local or cloud) | 18+ providers | GPT-4 only |
| Persistent Memory | **Hermes memory across sessions** | None | Skill library |

## Features

- **37 Actions** — mine, craft, fight, build, navigate, eat, equip, smelt, interact with containers
- **Sustained Combat** — `fight` action with auto-equip, attack loops, health-based retreat, flee from danger
- **Death Recovery** — tracks death location + lost items, `deathpoint` auto-navigates back
- **Container Management** — open chests, deposit/withdraw items programmatically
- **Location Memory** — `mark`/`marks`/`go_mark` system with persistent JSON storage, auto-saves spawn and death points
- **Multi-Agent** — run multiple bots with `multi_launch.sh`, each with its own LLM and personality
- **Stuck Detection** — watchdog monitors position, auto-cancels stuck tasks
- **Background Tasks** — long operations run async while agent stays responsive to chat
- **Persistent Learning** — Hermes memory saves lessons across sessions (deaths, preferences, locations)
- **Vision** — screenshots + AI analysis for build verification
- **Web Search** — agent can Google recipes, strategies, anything mid-game

## Quick Start

```bash
git clone https://github.com/bigph00t/hermescraft.git
cd hermescraft && ./setup.sh

# Open Minecraft, start a world, Open to LAN (note the port)
MC_PORT=35901 ./hermescraft.sh
```

Talk to the AI in Minecraft chat:
```
hermes follow me
hermes go mine some iron
hermes build a shelter before night
hermes there's a creeper behind you!
```

## Architecture

```
┌─────────────────────────────────────────┐
│           AI AGENT (Hermes)              │
│  Any LLM · Memory · Web Search · Vision  │
│  Runs `mc` CLI commands via terminal     │
└─────────────┬───────────────────────────┘
              │ bash commands
              ▼
┌─────────────────────────────────────────┐
│           mc CLI (bin/mc)                │
│  ~45 commands · human-readable output    │
│  Translates commands → HTTP API calls    │
└─────────────┬───────────────────────────┘
              │ HTTP (localhost:3001)
              ▼
┌─────────────────────────────────────────┐
│        Bot Server (bot/server.js)        │
│  Mineflayer · Pathfinder · Auto-eat      │
│  37 actions · Background tasks           │
│  Stuck detection · Death tracking        │
└─────────────┬───────────────────────────┘
              │ Minecraft protocol
              ▼
┌─────────────────────────────────────────┐
│        Minecraft Server (Java Ed.)       │
│  Any version 1.8–1.21+ · LAN or server  │
└─────────────────────────────────────────┘
```

The bot server is a dumb body. The AI agent is the brain. All decisions are made by the LLM.

## Multi-Agent Mode

Run multiple AI agents in one Minecraft world:

```bash
# Launch 2 agents (Steve + Alex)
./multi_launch.sh

# Launch 3 agents
./multi_launch.sh "" 3

# Or manually with custom names
./hermescraft.sh --name Steve --port 3001 &
./hermescraft.sh --name Alex --port 3002 &
```

Agents coordinate through Minecraft's in-game chat. They see each other, share discoveries, and can cooperate or compete.

## Full Command Reference

### Observation
| Command | Description |
|---------|-------------|
| `mc status` | Health, inventory, position, nearby blocks/entities, chat |
| `mc inventory` | Categorized inventory breakdown |
| `mc nearby [radius]` | Blocks + entities in radius |
| `mc read_chat [count]` | Recent chat messages |
| `mc commands` | Pending player requests |
| `mc health` | Quick connection check |
| `mc find_blocks BLOCK [radius]` | Search for block positions |
| `mc find_entities [type]` | Find mobs/players nearby |
| `mc screenshot` | Capture game window for vision |

### Movement
| Command | Description |
|---------|-------------|
| `mc goto X Y Z` | Pathfind to exact position |
| `mc goto_near X Y Z [range]` | Pathfind near position |
| `mc follow PLAYER` | Follow a player continuously |
| `mc look_at X Y Z` | Face coordinates |
| `mc stop` | Cancel all movement/mining |

### Mining
| Command | Description |
|---------|-------------|
| `mc collect BLOCK [count]` | Find + mine blocks (auto-pickup) |
| `mc dig X Y Z` | Break specific block |
| `mc pickup` | Grab nearby item drops |

### Crafting
| Command | Description |
|---------|-------------|
| `mc craft ITEM [count]` | Craft item (auto-finds table) |
| `mc recipes ITEM` | Look up crafting recipe |
| `mc smelt INPUT [fuel] [count]` | Smelt in nearby furnace |

### Combat
| Command | Description |
|---------|-------------|
| `mc fight [target] [retreat_hp] [duration]` | Sustained combat with auto-retreat |
| `mc flee [distance]` | Sprint away from nearest hostile |
| `mc attack [target]` | Single attack on nearest entity |
| `mc eat` | Eat best food in inventory |
| `mc equip ITEM [slot]` | Equip tool/weapon/armor |

### Building
| Command | Description |
|---------|-------------|
| `mc place BLOCK X Y Z` | Place block at position |
| `mc interact X Y Z` | Right-click block (doors, buttons) |
| `mc close` | Close open screen/GUI |

### Containers
| Command | Description |
|---------|-------------|
| `mc chest X Y Z` | List contents of chest/barrel |
| `mc deposit ITEM X Y Z [count]` | Put items into container |
| `mc withdraw ITEM X Y Z [count]` | Take items from container |

### Locations
| Command | Description |
|---------|-------------|
| `mc mark NAME [note]` | Save current position |
| `mc marks` | List all saved locations |
| `mc go_mark NAME` | Navigate to saved location |
| `mc unmark NAME` | Delete saved location |

### Social
| Command | Description |
|---------|-------------|
| `mc chat "message"` | Send chat message |
| `mc chat_to PLAYER "message"` | Private whisper |

### Death Recovery
| Command | Description |
|---------|-------------|
| `mc deaths` | Death history + last death details |
| `mc deathpoint` | Navigate to last death location |

### Background Tasks
| Command | Description |
|---------|-------------|
| `mc bg_collect BLOCK [count]` | Mine in background |
| `mc bg_goto X Y Z` | Navigate in background |
| `mc bg_fight [target]` | Fight in background |
| `mc task` | Check background task status |
| `mc cancel` | Cancel running task |

### Utility
| Command | Description |
|---------|-------------|
| `mc use` | Use held item |
| `mc toss ITEM [count]` | Drop items |
| `mc sleep` | Sleep in nearby bed |
| `mc wait [seconds]` | Wait |
| `mc connect` | (Re)connect to server |

## Why Hermes Agent

This project is built on [Hermes Agent](https://github.com/NousResearch/hermes-agent), the open-source autonomous agent framework by Nous Research:

- **Full agent capabilities** — persistent memory, web search, vision, skills, delegation
- **Any LLM backend** — local models (free), Claude, GPT-4, Gemini, anything
- **SOUL personality system** — behavior shaped by a single markdown file
- **Terminal tool integration** — agent runs `mc` commands naturally, no special wiring
- **Memory across sessions** — agent remembers deaths, preferences, locations between restarts

## Configuration

```bash
MC_HOST=localhost      # Minecraft server host
MC_PORT=25565          # Server port (check LAN port)
MC_USERNAME=HermesBot  # Bot name in-game
API_PORT=3001          # Bot HTTP API port
```

## How to Add Features

1. Add action to `bot/server.js` ACTIONS object
2. Add CLI command to `bin/mc` case statement
3. Update `SOUL-minecraft.md` if the AI needs to know about it

That's it. Three files.

## Project Structure

```
hermescraft/
├── hermescraft.sh          Main launcher
├── multi_launch.sh         Multi-agent launcher
├── setup.sh                First-time setup
├── SOUL-minecraft.md       Agent personality/behavior
├── bot/
│   ├── server.js           Mineflayer bot + HTTP API
│   └── package.json
├── bin/
│   └── mc                  CLI wrapper (~45 commands)
├── skills/                 Hermes skill files
│   ├── minecraft-survival.md
│   ├── minecraft-combat.md
│   ├── minecraft-building.md
│   ├── minecraft-farming.md
│   └── minecraft-navigation.md
└── profiles/               Custom SOUL files for multi-agent
```

## Requirements

- Node.js 18+
- Python 3
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) (`pip install hermes-agent`)
- Minecraft Java Edition (1.8–1.21+)

## License

MIT

## Credits

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) bot library
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)
- mineflayer-armor-manager, mineflayer-auto-eat, mineflayer-collectblock
