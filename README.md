# ⚡ HermesCraft

Talk to Hermes through Minecraft. Same AI, new interface — like Telegram but with blocks.

HermesCraft connects [Hermes Agent](https://github.com/NousResearch/hermes-agent) to Minecraft via a Mineflayer bot. Hermes joins your world, chats with you in-game, follows instructions, mines, crafts, builds, fights, explores — and can still search the web, use memory, and do anything else Hermes normally does. All through Minecraft chat.

## Quick Start

```bash
git clone https://github.com/bigph00t/hermescraft.git
cd hermescraft
./setup.sh

# Open Minecraft, start a world, Open to LAN (note the port)
MC_PORT=35901 ./hermescraft.sh
```

Then in Minecraft chat:
```
hermes follow me
hermes build a house
hermes go mine some iron
hermes what's the weather in tokyo?
```

## How It Works

```
You (Minecraft) ──chat──▶ Bot Server ──queue──▶ Hermes Agent
                                                    │
                ◀──chat── Bot Server ◀──mc CLI──────┘
```

- **Bot server** (`bot/server.js`): Mineflayer bot with HTTP API. Handles the Minecraft connection, movement, combat, crafting. Responds instantly to simple commands (follow, stop, hello).
- **mc CLI** (`bin/mc`): Shell commands to control the bot. `mc status`, `mc collect oak_log 5`, `mc craft stone_pickaxe`, `mc chat "hello"`.
- **Hermes Agent**: The brain. Uses `mc` commands via terminal. Has Minecraft skills, personality, web access, memory — everything.

Simple commands ("hermes follow me", "hermes stop") are handled instantly by the bot. Complex requests ("hermes build a house") get queued for Hermes to plan and execute.

## Usage

```bash
# Play together (default — companion mode)
./hermescraft.sh

# Play with a specific goal
./hermescraft.sh "survive and build a base"
./hermescraft.sh "find diamonds"

# Just start the bot (no Hermes AI)
./hermescraft.sh --bot-only

# Then control manually
mc status
mc collect oak_log 10
mc craft wooden_pickaxe
mc chat "I am a bot"
```

## mc CLI Reference

```
OBSERVE:
  mc status              Full state — health, pos, inventory, nearby, chat
  mc inventory           Categorized inventory
  mc nearby [radius]     Blocks + entities around you
  mc read_chat           Recent player messages
  mc commands            Queued requests from player
  mc health              Quick connection check

MOVE:
  mc goto X Y Z          Walk to position
  mc follow PLAYER       Follow a player
  mc stop                Stop everything

MINE:
  mc collect BLOCK [N]   Find + mine blocks
  mc dig X Y Z           Break specific block
  mc pickup              Grab nearby item drops
  mc find_blocks BLOCK   Search for block type

CRAFT:
  mc craft ITEM [N]      Craft item
  mc recipes ITEM        Look up recipe
  mc smelt INPUT         Smelt in furnace

FIGHT:
  mc attack [target]     Attack nearest hostile
  mc eat                 Eat food
  mc equip ITEM          Equip tool/weapon

BUILD:
  mc place BLOCK X Y Z   Place a block
  mc interact X Y Z      Open chest, door, etc

CHAT:
  mc chat "message"      Say something in game

FLAGS:
  --json                 Raw JSON output
```

## In-Game Chat Commands

Say these in Minecraft chat (prefix with "hermes"):

| Chat | What happens |
|------|-------------|
| `hermes follow me` | Starts following you |
| `hermes stop` | Stops all actions |
| `hermes hello` | Greets you |
| `hermes status` | Reports health/pos |
| `hermes inventory` | Lists items |
| `hermes goto 100 64 -200` | Walks to coordinates |
| `hermes eat` | Eats food |
| `hermes give me wood` | Drops items for you |
| `hermes where are you` | Reports position |
| `hermes help` | Lists commands |
| `hermes build a house` | *Queued for AI* |
| `hermes find diamonds` | *Queued for AI* |

Simple commands execute instantly. Complex ones get acknowledged and queued for Hermes to handle with planning.

## Configuration

```bash
MC_HOST=localhost      # Minecraft server
MC_PORT=25565          # Server port
MC_USERNAME=HermesBot  # Bot name
API_PORT=3001          # Bot API port
```

### Server Requirements
- Any Minecraft Java Edition server (1.8–1.21+)
- `online-mode=false` in server.properties (or use MS auth)
- LAN worlds work — note the port from "Open to LAN"

## Files

```
hermescraft/
├── hermescraft.sh          # Main launcher
├── play.sh                 # Alias
├── setup.sh                # First-time setup
├── SOUL-minecraft.md       # Hermes personality for MC
├── bot/
│   ├── server.js           # Mineflayer bot + HTTP API
│   └── package.json
├── bin/
│   └── mc                  # CLI wrapper
└── skills/
    ├── minecraft-survival.md
    ├── minecraft-combat.md
    ├── minecraft-building.md
    ├── minecraft-farming.md
    └── minecraft-navigation.md
```

## Requirements

- Node.js ≥ 18
- Python 3
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) (`pip install hermes-agent`)
- Minecraft Java Edition

## License

MIT
