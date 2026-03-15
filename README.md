# HermesCraft — AI Minecraft Agent + Arena

Hermes agents play Minecraft through a CLI-controlled bot server. Each agent
observes the world, makes decisions, and acts — mining, crafting, building,
fighting, and communicating with other players.

**v4.0** adds fair-play perception, advanced combat, fire-and-forget smelting,
team coordination, and the Arena system for multi-agent PvP battles.

## Architecture

```
Hermes Agent ──mc CLI──► Bot Server (HTTP :3001) ──► Mineflayer ──► Minecraft
```

- **Bot Server** (`bot/server.js`): Node.js HTTP API wrapping Mineflayer with 55+ actions
- **mc CLI** (`bin/mc`): Bash tool the agent calls via terminal
- **Arena** (`arena.js`): Coordinator for team battles (spawns N bot servers, assigns teams)

## Quick Start

```bash
# 1. Install deps
cd bot && npm install && cd ..

# 2. Start Minecraft server (Java 1.21.x, offline mode)
# ... your server setup ...

# 3. Start bot server
node bot/server.js

# 4. Play (from Hermes)
mc status           # see the world
mc collect oak_log 5  # mine some wood
mc craft wooden_pickaxe
mc chat "hello!"
```

## What's New in v4.0

### Fair Play Mode (on by default)
Bots no longer have X-ray vision. The perception system simulates realistic awareness:

- **Line-of-Sight**: Entities behind solid blocks are invisible to the bot
- **Sneak Detection**: Sneaking players only detected within 8 blocks (vs 48 normally)
- **Sound System**: Mining/sprinting creates directional sound cues instead of exact positions
- **Reaction Delay**: 100-300ms random delay on combat actions (human-like)

Toggle: `mc fair_play on|off` or set `FAIR_PLAY=false` env var.

### Advanced Combat (9 new actions)
- `mc sneak on/off` — Hide nameplate, reduce detection (actually matters now!)
- `mc shield [duration]` — Raise shield to block hits
- `mc shoot [target]` — Bow with predictive aiming
- `mc sprint_attack [target]` — Sprint + hit for extra knockback
- `mc crit [target]` — Jump-attack for 150% damage
- `mc strafe [target] [dir] [dur]` — Circle-strafe while attacking
- `mc combo [target] [style]` — Pre-built sequences: aggressive/defensive/ranged/berserker
- `mc bg_combo` / `mc bg_strafe` — Background versions

### Fire-and-Forget Smelting
No more standing at the furnace for 10 minutes:
```bash
mc smelt_start raw_iron coal 64   # Load furnace, returns immediately
# ... go mine, fight, build for 10 minutes ...
mc furnace_check 10 65 5          # Check progress
mc furnace_take 10 65 5           # Collect when ready
mc furnaces                       # See all tracked furnaces
```

### Team System
```bash
mc set_team red warrior "RedCmdr,RedRanger1,RedSupport1"
mc team_chat "pushing north, follow me"
mc team_status          # See teammates' positions + health
mc rally 100 64 -200 "regroup here!"
mc report "3 enemies at bridge"
mc stats                # Kill/death/assist tracking
```

## Arena — Multi-Agent PvP

Run 10v10 (or any size) battles between AI agents:

```bash
# Start the arena coordinator
./arena_launch.sh 10        # 10v10 match

# In another terminal:
curl -X POST http://localhost:3100/setup    # Spawn all bots
curl -X POST http://localhost:3100/start    # BEGIN BATTLE!
curl http://localhost:3100/status            # Live scores
curl http://localhost:3100/scoreboard        # Kill feed
curl -X POST http://localhost:3100/stop      # End match
```

Each bot gets:
- Its own server on ports 3001-3020
- Team assignment (red/blue) and role (commander/warrior/ranger/support)
- Fair play constraints (no wallhacks)
- Team communication channel

See `ARENA.md` for the full design document.
See `souls/` for role-specific AI prompts.

## Full Command Reference

### Observation
| Command | Description |
|---------|-------------|
| `mc status` | Full state: health, pos, inventory, nearby |
| `mc inventory` | Categorized inventory |
| `mc nearby [radius]` | Blocks + entities nearby |
| `mc read_chat [n]` | Recent chat messages |
| `mc health` | Quick connection check |
| `mc sounds` | Recent sound events (fair play) |
| `mc stats` | Combat kill/death/assist stats |
| `mc furnaces` | Active furnace tracking |

### Movement
| Command | Description |
|---------|-------------|
| `mc goto X Y Z` | Navigate to position |
| `mc goto_near X Y Z [r]` | Navigate near position |
| `mc follow PLAYER` | Follow a player |
| `mc look_at X Y Z` | Look at position |
| `mc stop` | Stop all movement |

### Mining & Crafting
| Command | Description |
|---------|-------------|
| `mc collect BLOCK [n]` | Find + mine N blocks |
| `mc dig X Y Z` | Break specific block |
| `mc pickup` | Pick up nearby items |
| `mc find_blocks BLOCK` | Find block locations |
| `mc craft ITEM [n]` | Craft an item |
| `mc recipes ITEM` | Look up recipe |
| `mc smelt INPUT [fuel]` | Smelt (blocking, legacy) |
| `mc smelt_start INPUT [fuel] [n]` | Load furnace, leave immediately |
| `mc furnace_check X Y Z` | Check furnace status |
| `mc furnace_take X Y Z` | Collect furnace output |

### Combat
| Command | Description |
|---------|-------------|
| `mc attack [target]` | Single hit |
| `mc fight [target] [hp] [dur]` | Sustained combat |
| `mc flee [distance]` | Flee from threats |
| `mc eat` | Eat best food |
| `mc equip ITEM [slot]` | Equip weapon/armor |
| `mc sneak [on\|off]` | Toggle sneak (stealth) |
| `mc shield [duration]` | Block with shield |
| `mc shoot [target]` | Bow/crossbow with prediction |
| `mc sprint_attack [target]` | Sprint hit (extra knockback) |
| `mc crit [target]` | Jump-attack (150% damage) |
| `mc strafe [tgt] [dir] [dur]` | Circle-strafe combat |
| `mc combo [tgt] [style]` | Combat combo sequence |

### Building & Containers
| Command | Description |
|---------|-------------|
| `mc place BLOCK X Y Z` | Place a block |
| `mc interact X Y Z` | Right-click a block |
| `mc chest X Y Z` | List container contents |
| `mc deposit ITEM X Y Z [n]` | Put item in container |
| `mc withdraw ITEM X Y Z [n]` | Take item from container |

### Team (Arena)
| Command | Description |
|---------|-------------|
| `mc set_team TEAM ROLE [mates]` | Join a team |
| `mc team_chat "msg"` | Team-only message |
| `mc team_status` | Teammate positions + health |
| `mc rally X Y Z [msg]` | Set rally point |
| `mc report "msg"` | Send intel to team |

### Locations & Death
| Command | Description |
|---------|-------------|
| `mc mark NAME [note]` | Save current location |
| `mc marks` | List saved locations |
| `mc go_mark NAME` | Navigate to saved location |
| `mc deaths` | Death count + last death |
| `mc deathpoint` | Go to last death spot |

### Background Tasks
| Command | Description |
|---------|-------------|
| `mc bg_collect BLOCK [n]` | Mine in background |
| `mc bg_goto X Y Z` | Navigate in background |
| `mc bg_fight [target]` | Fight in background |
| `mc bg_combo [tgt] [style]` | Combo in background |
| `mc bg_strafe [tgt] [dir]` | Strafe in background |
| `mc task` | Check task status |
| `mc cancel` | Cancel current task |

### Utility
| Command | Description |
|---------|-------------|
| `mc chat "msg"` | Send chat message |
| `mc chat_to PLAYER "msg"` | Whisper to player |
| `mc use` | Use held item |
| `mc toss ITEM [n]` | Drop items |
| `mc sleep` | Sleep in bed |
| `mc wait [seconds]` | Wait |
| `mc connect` | Reconnect bot |
| `mc fair_play [on\|off]` | Toggle fair play mode |

## File Structure

```
hermescraft/
├── bot/
│   ├── server.js          # Bot server (1950 lines, 55+ actions)
│   └── package.json
├── bin/
│   └── mc                 # CLI tool (866 lines)
├── arena.js               # Match coordinator for PvP
├── arena_launch.sh        # Launch script for arena
├── souls/                 # Team role prompts
│   ├── team-commander.md
│   ├── team-warrior.md
│   ├── team-ranger.md
│   └── team-support.md
├── skills/                # Minecraft skill docs
├── data/                  # Locations, match history
├── ARENA.md               # Arena design document
├── SOUL-minecraft.md      # Solo play persona
├── hermescraft.sh         # Solo play launcher
├── multi_launch.sh        # Multi-bot launcher
└── setup.sh               # Initial setup script
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_HOST` | `localhost` | Minecraft server host |
| `MC_PORT` | `25565` | Minecraft server port |
| `MC_USERNAME` | `HermesBot` | Bot username |
| `MC_AUTH` | `offline` | Auth type (offline/microsoft) |
| `API_PORT` | `3001` | Bot HTTP API port |
| `MC_API_URL` | `http://localhost:3001` | CLI target URL |
| `FAIR_PLAY` | `true` | Enable LOS + sound + reaction delay |
| `ARENA_PORT` | `3100` | Arena coordinator port |

## Credits

Built by bigph00t with Hermes Agent.
Powered by Mineflayer, mineflayer-pathfinder, mineflayer-armor-manager,
mineflayer-auto-eat, and mineflayer-collectblock.
