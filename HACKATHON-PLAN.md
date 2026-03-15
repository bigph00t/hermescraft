# HERMESCRAFT — HACKATHON MASTER PLAN
## Target: $5,000 Hackathon Prize
## Generated: 2026-03-15
## Status: COMPREHENSIVE IMPLEMENTATION PLAN

---

# TABLE OF CONTENTS

1. [Project Overview & Vision](#1-project-overview--vision)
2. [Current Architecture](#2-current-architecture)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Known Bugs & Critical Fixes](#4-known-bugs--critical-fixes)
5. [Feature Implementation Plan](#5-feature-implementation-plan)
6. [SOUL & AI Behavior Overhaul](#6-soul--ai-behavior-overhaul)
7. [README & GitHub Presentation](#7-readme--github-presentation)
8. [Demo Script](#8-demo-script)
9. [Task Checklist](#9-task-checklist)

---

# 1. PROJECT OVERVIEW & VISION

## What HermesCraft IS

HermesCraft connects Hermes Agent (an autonomous AI assistant by Nous Research) to Minecraft via a Mineflayer bot. The AI joins your world as a real player — it chats, mines, crafts, builds, fights, explores — and can still search the web, use persistent memory, save skills, and do anything Hermes normally does. All through Minecraft chat.

## The Hackathon Angle

**MiroFish** (26.5k GitHub stars) builds a parallel digital world populated by thousands of AI agents with personalities, memory, and social dynamics to PREDICT real-world outcomes. It's a simulation engine for decision-makers.

**HermesCraft's positioning:** MiroFish simulates a FAKE world. We put AI agents in a REAL one. Minecraft has genuine physics, resource constraints, day/night cycles, hostile mobs, and — critically — other human and AI players. This is the foundation for:

1. **Embodied AI Companions** — AI that lives alongside humans in persistent virtual worlds
2. **Lifelong Learning Agents** — agents that accumulate skills, memory, and world knowledge over time
3. **Multi-Agent Societies** — multiple AI personalities cooperating, specializing, forming emergent social structures
4. **Human-AI Coexistence Testing** — the safest place to study how AI integrates into human communities

**The pitch (30 seconds):**
> "MiroFish builds fake worlds full of AI agents to predict outcomes. We put the agent IN the world. HermesCraft is an open-source framework for persistent, embodied AI companions that learn, remember, adapt, and cooperate with humans in Minecraft. Today it's one agent building a cabin with you. The architecture supports hundreds of agents building civilizations. This is the training ground for AI that lives alongside us."

## Technical Stack

- **Hermes Agent**: Nous Research's autonomous AI agent (CLI, multi-provider LLM, persistent memory, tool use, skills)
- **Mineflayer**: JavaScript Minecraft bot library (movement, combat, crafting, inventory, chat)
- **mineflayer-pathfinder**: A* pathfinding for navigation
- **mineflayer-armor-manager**: Auto armor equipping
- **mineflayer-auto-eat**: Automatic eating when hungry
- **Node.js v24** + ESM modules
- **Bash CLI** (`mc` command) wrapping HTTP API
- **Python3** for CLI pretty-printing
- **scrot + xdotool** for game screenshots (vision)

## Repository

- **GitHub**: https://github.com/bigph00t/hermescraft.git
- **Local path**: /home/bigphoot/hermescraft/
- **License**: MIT

---

# 2. CURRENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                    HERMES AGENT                       │
│  (LLM brain - Claude/GPT/local via Hermes CLI)       │
│  • Persistent memory across sessions                  │
│  • Web search, vision, tool use                       │
│  • Skills library for Minecraft knowledge             │
│  • SOUL personality file defines behavior             │
│                                                       │
│  Uses `mc` CLI commands via terminal tool              │
└─────────────┬───────────────────────────────────────┘
              │ bash commands (mc status, mc collect, etc.)
              ▼
┌─────────────────────────────────────────────────────┐
│                    mc CLI (bin/mc)                     │
│  Bash script - 571 lines                              │
│  ~35 commands, human-readable output via Python3      │
│  Translates commands → HTTP API calls                 │
└─────────────┬───────────────────────────────────────┘
              │ HTTP (localhost:3001)
              ▼
┌─────────────────────────────────────────────────────┐
│              BOT SERVER (bot/server.js)                │
│  Node.js - 1077 lines - Mineflayer + plugins          │
│                                                       │
│  GET endpoints (8):                                   │
│    /health /status /inventory /nearby                  │
│    /chat /commands /task /                             │
│                                                       │
│  POST /action/* (24 sync actions):                    │
│    goto, goto_near, follow, look, stop                │
│    collect, dig, pickup, find_blocks, find_entities    │
│    craft, recipes, smelt                               │
│    attack, eat, equip, toss                            │
│    place, interact, close_screen                       │
│    chat, wait, use, sleep_bed                          │
│    complete_command                                     │
│                                                       │
│  POST /task/* (background tasks):                     │
│    /task/ACTION - run any action async                 │
│    /task/cancel - cancel running task                  │
│                                                       │
│  Chat handling:                                        │
│    All "hermes ..." messages queued for AI             │
│    No reactive handlers - AI makes ALL decisions       │
│                                                       │
│  State piggybacking:                                   │
│    Every response includes new_chat, pending_commands  │
│    task status in briefState()                         │
│                                                       │
│  Plugins loaded:                                       │
│    pathfinder, armor-manager, auto-eat, collectblock   │
│    (pvp DISABLED - breaks pathfinder physics)          │
└─────────────┬───────────────────────────────────────┘
              │ Mineflayer protocol
              ▼
┌─────────────────────────────────────────────────────┐
│              MINECRAFT SERVER                          │
│  Any Java Edition server (1.8 - 1.21+)                │
│  LAN worlds, dedicated servers, Realms                 │
│  offline-mode or MS auth                               │
└─────────────────────────────────────────────────────┘
```

## File Structure

```
hermescraft/                     (root)
├── bot/
│   ├── server.js                (1077 lines - Mineflayer bot + HTTP API)
│   ├── package.json             (dependencies)
│   └── package-lock.json
├── bin/
│   └── mc                       (571 lines - CLI wrapper)
├── skills/
│   ├── minecraft-building.md    (127 lines)
│   ├── minecraft-combat.md      (94 lines)
│   ├── minecraft-farming.md     (79 lines)
│   ├── minecraft-navigation.md  (92 lines)
│   └── minecraft-survival.md    (126 lines)
├── hermescraft.sh               (156 lines - launcher)
├── setup.sh                     (185 lines - first-time setup)
├── play.sh                      (alias for hermescraft.sh)
├── SOUL-minecraft.md            (177 lines - AI personality/behavior)
├── README.md                    (168 lines)
├── AUDIT-REPORT.md              (334 lines - codebase audit)
├── HACKATHON-PLAN.md            (this file)
└── .gitignore
```

---

# 3. COMPETITIVE LANDSCAPE

## Key Projects

| Project | What It Does | Stars | Our Advantage |
|---------|-------------|-------|---------------|
| **MiroFish** | Parallel world simulation with AI agents for prediction | 26.5k | We're embodied in a REAL world, not simulated |
| **Voyager** (NVIDIA) | LLM lifelong learning agent in MC | 5k+ | We have human interaction, memory, multi-agent potential |
| **Mindcraft** | LLM + Mineflayer framework | 3k+ | We integrate with a full AI agent platform (Hermes), not just an LLM |
| **Project Sid** (Altera) | 1000+ agents building civilization | Paper | We're open-source and accessible, they're closed |
| **GITM** | LLM-based MC agent | Paper | We focus on human-AI cooperation, not solo play |

## Our Unique Differentiators

1. **Full AI Agent, Not Just LLM**: Hermes has persistent memory, web access, skill system, vision — not just chat completion
2. **Human-AI Cooperation**: Designed to play WITH humans, not solo. Teaching, learning, adapting to player preferences
3. **Persistent Learning**: Memory survives across sessions. Teach it once, it remembers forever
4. **Game-Agnostic Architecture**: HTTP API + CLI + AI agent pattern works for any game with a bot API
5. **Open Source & Accessible**: `git clone && ./setup.sh && ./hermescraft.sh` — anyone can run it
6. **Built on Hermes Agent**: Inherits all Hermes capabilities (Telegram integration, cron jobs, multi-provider LLM, etc.)

---

# 4. KNOWN BUGS & CRITICAL FIXES

These are bugs found in the current codebase that MUST be fixed.

## Bug 1: `toss` Ignores Count Parameter
**File**: `bot/server.js` ~line 821
**Problem**: `toss({item, count})` receives count but calls `b.tossStack(invItem)` which drops the ENTIRE stack.
**Fix**: Use `b.toss(invItem.type, null, count)` instead of `b.tossStack(invItem)`.

## Bug 2: No Reconnect on Kick
**File**: `bot/server.js` ~line 470-473
**Problem**: `bot.on('kicked')` sets `botReady=false` but doesn't trigger auto-reconnect. The `end` event does reconnect, but `kicked` doesn't.
**Fix**: Add reconnect logic to the kicked handler (same as end handler).

## Bug 3: Chat Log Clears on Read
**File**: `bot/server.js` ~line 940-945
**Problem**: `GET /chat` clears the chat log by default (`clear !== 'false'`). If the AI reads chat via `mc read_chat` AND the briefState also reads recent chat, messages can be lost.
**Fix**: Don't clear by default. Add a separate `POST /chat/clear` endpoint, or use a read-pointer instead of deleting.

## Bug 4: Infinite Reconnect with No Backoff
**File**: `bot/server.js` ~line 478-483
**Problem**: On disconnect, reconnects every 5 seconds forever. No backoff, no max retries.
**Fix**: Exponential backoff (5s, 10s, 20s, 40s, 60s cap). Max 20 retries. Log each attempt.

## Bug 5: Silent Error Swallowing in Collect
**File**: `bot/server.js` ~line 530-536
**Problem**: Inner mining loop has bare `catch {}` that silently swallows ALL errors. Could fail on every block and report "Mined 0/20" with no explanation.
**Fix**: Log errors, accumulate error messages, include in response.

## Bug 6: config.mc.auth Assignment
**File**: `bot/server.js` line 60
**Problem**: Line reads `config.mc.auth=***` — appears to be a redaction artifact that broke the actual assignment.
**Fix**: Should be `config.mc.auth = next; i++;`

## Bug 7: Background Task Overwrite
**File**: `bot/server.js` ~line 988-1008
**Problem**: Starting a new background task silently abandons the old one's tracking. Old task result is lost.
**Fix**: Check if a task is already running. Either reject the new one or cancel the old one explicitly first.

## Bug 8: pvp Still in package.json
**File**: `bot/package.json`
**Problem**: `mineflayer-pvp` is still listed as a dependency even though it's disabled (breaks pathfinder). Confusing for contributors.
**Fix**: Remove from package.json, add comment explaining why.

---

# 5. FEATURE IMPLEMENTATION PLAN

## FEATURE 1: Sustained Combat System
**Priority**: CRITICAL — bot currently dies to any mob
**Effort**: Medium

### Problem
`mc attack zombie` hits once and returns. Zombies have 20HP and need 4-5 sword hits. The AI must call attack 5 times manually, checking health between each call. During this, the zombie is hitting back. The bot often dies.

### Implementation

**New ACTIONS in server.js:**

```javascript
async fight({ target, retreat_health = 6 }) {
  const b = ensureBot();
  // Find target entity
  // Equip best weapon (sword > axe > hand)
  // Enter combat loop:
  //   - If health < retreat_health, flee (pathfind 16 blocks away), eat food, return
  //   - If target dead, return success
  //   - If target too far (>4 blocks), pathfind closer
  //   - Attack, wait for attack cooldown (~0.6s for sword)
  //   - Repeat
  // Track: damage dealt, damage taken, food consumed
  // Return: { result: "Killed zombie. Took 8 damage, ate 1 cooked_beef." }
}

async flee({ distance = 16 }) {
  const b = ensureBot();
  // Calculate position opposite to nearest hostile mob
  // Pathfind there
  // Return result
}
```

**New CLI commands:**
```
mc fight [target]          # sustained combat until target dead or health critical
mc flee [distance]         # run away from nearest hostile
```

**SOUL addition:** Combat decision tree:
- HP < 6 with food → eat immediately
- HP < 6 no food → flee
- Hostile within 8 blocks → fight (bg task) or flee
- Creeper → ALWAYS flee (they explode)
- Skeleton at range → close distance, then fight
- Multiple hostiles → fight one at a time, retreat if overwhelmed

### Files to Modify
- `bot/server.js`: Add `fight` and `flee` to ACTIONS object (~80 lines)
- `bin/mc`: Add `fight` and `flee` CLI commands (~15 lines)
- `SOUL-minecraft.md`: Add combat decision tree section (~20 lines)
- `skills/minecraft-combat.md`: Update with new commands

---

## FEATURE 2: Death Recovery System
**Priority**: CRITICAL — bot gets amnesia on death
**Effort**: Small-Medium

### Problem
When the bot dies, it respawns with empty inventory. The death position is logged in `deathLog` but not exposed in the API. The AI has no idea where it died, what it lost, or how to recover. Items on the ground despawn in 5 minutes.

### Implementation

**Enhance death tracking in server.js:**

```javascript
// On death event, capture:
let lastDeath = null;

bot.on('death', () => {
  lastDeath = {
    time: Date.now(),
    position: posObj(),
    inventory: bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
    cause: 'unknown' // try to detect from recent damage
  };
  deathLog.push(lastDeath);
  log(`DIED at ${JSON.stringify(lastDeath.position)}! Had ${lastDeath.inventory.length} item types.`);
});
```

**New GET endpoint:**
```
GET /deaths → { last_death: { time, position, inventory_lost, seconds_ago }, total_deaths: N }
```

**New CLI command:**
```
mc deaths                  # show death history + last death location
mc deathpoint              # navigate to last death location (alias for goto last death pos)
```

**SOUL addition:**
```
## After Death
When you die:
1. Run `mc deaths` to see where you died and what you lost
2. If < 5 minutes ago, rush back: `mc bg_goto <death_x> <death_y> <death_z>`
3. Run `mc pickup` when you arrive to grab your dropped items
4. Tell the player what happened: "I died! Running back to grab my stuff."
5. If > 5 minutes, items are gone. Start fresh, tell the player.
```

### Files to Modify
- `bot/server.js`: Enhance death event handler, add `/deaths` endpoint (~40 lines)
- `bin/mc`: Add `deaths` and `deathpoint` commands (~20 lines)
- `SOUL-minecraft.md`: Add death recovery section (~15 lines)

---

## FEATURE 3: Container Interaction (Chest Deposit/Withdraw)
**Priority**: CRITICAL — can't store items
**Effort**: Medium

### Problem
The bot can `mc interact X Y Z` to open a chest, but can't move items in or out. Without chest interaction, the bot can't manage inventory, create storage, or organize resources. This is fundamental to Minecraft gameplay.

### Implementation

**New ACTIONS in server.js:**

```javascript
async deposit({ item, count, x, y, z }) {
  const b = ensureBot();
  // If x,y,z provided, interact with that block first
  // Otherwise, use currently open window
  // Find item in inventory by name
  // Use b.openContainer() or b.currentWindow
  // Use window.deposit(itemType, null, count)
  // Close container
  // Return { result: "Deposited 32 cobblestone into chest at X,Y,Z" }
}

async withdraw({ item, count, x, y, z }) {
  const b = ensureBot();
  // Similar to deposit but in reverse
  // Use window.withdraw(itemType, null, count)
  // Return { result: "Withdrew 16 iron_ingot from chest at X,Y,Z" }
}

async list_container({ x, y, z }) {
  const b = ensureBot();
  // Open container, read contents, close
  // Return { result: "Chest contains: ...", items: [...] }
}
```

**New CLI commands:**
```
mc deposit ITEM [count] [X Y Z]    # put items in nearest/specified chest
mc withdraw ITEM [count] [X Y Z]   # take items from nearest/specified chest
mc chest [X Y Z]                    # list contents of nearest/specified chest
```

### Mineflayer Container API Reference
```javascript
// Open a chest/container
const chest = await bot.openContainer(bot.blockAt(new Vec3(x, y, z)));
// Read contents
const items = chest.containerItems(); // array of Item
// Deposit
await chest.deposit(itemType, metadata, count);
// Withdraw
await chest.withdraw(itemType, metadata, count);
// Close
chest.close();
```

### Files to Modify
- `bot/server.js`: Add `deposit`, `withdraw`, `list_container` to ACTIONS (~80 lines)
- `bin/mc`: Add `deposit`, `withdraw`, `chest` commands (~25 lines)
- `SOUL-minecraft.md`: Add inventory management guidance (~15 lines)

---

## FEATURE 4: Coordinate Memory System
**Priority**: HIGH — bot has no sense of place
**Effort**: Small

### Problem
The AI can use Hermes memory to remember locations, but there's no structured way to save/recall coordinates. Real players remember where their base is, where they found diamonds, where they died. The bot forgets everything on restart.

### Implementation

**File-based storage:** `/home/bigphoot/hermescraft/data/locations.json`

```json
{
  "home": { "x": 100, "y": 64, "z": -200, "note": "Main cabin", "saved": "2026-03-15T10:00:00Z" },
  "mine": { "x": 100, "y": 12, "z": -180, "note": "Iron mine", "saved": "2026-03-15T11:00:00Z" },
  "death_1": { "x": 50, "y": 32, "z": -100, "note": "Killed by creeper", "saved": "2026-03-15T12:00:00Z" }
}
```

**New ACTIONS in server.js:**

```javascript
async mark({ name, note }) {
  const b = ensureBot();
  const pos = posObj();
  // Read locations.json, add/update entry, write back
  // Return { result: "Saved 'home' at X, Y, Z" }
}

async marks() {
  // Read locations.json, return all entries with distances from current pos
}

async go_mark({ name }) {
  // Read locations.json, get coords, pathfind there
}

async unmark({ name }) {
  // Remove from locations.json
}
```

**New CLI commands:**
```
mc mark NAME [note]         # save current position with a name
mc marks                    # list all saved locations with distances
mc go_mark NAME             # navigate to a saved location
mc unmark NAME              # delete a saved location
```

**Auto-save locations on events:**
- Save "last_death" on death
- Save "spawn" on first spawn
- Player can say "hermes mark this as home" → AI calls `mc mark home`

### Files to Modify
- `bot/server.js`: Add mark/marks/go_mark/unmark actions + file I/O (~60 lines)
- `bin/mc`: Add CLI commands (~25 lines)
- `SOUL-minecraft.md`: Add location memory guidance (~10 lines)
- Create: `data/` directory (add to .gitignore)

---

## FEATURE 5: Stuck Detection & Recovery
**Priority**: HIGH — bot gets stuck silently
**Effort**: Small-Medium

### Problem
The bot can get stuck: pathfinder loops, mining air, walking into walls. No one notices. The AI keeps waiting for a response that never comes (synchronous) or sees "task running" forever (background).

### Implementation

**Watchdog in server.js:**

```javascript
// Track position history
let positionHistory = [];
const STUCK_CHECK_INTERVAL = 5000; // 5 seconds
const STUCK_THRESHOLD = 30000; // 30 seconds no movement = stuck

setInterval(() => {
  if (!bot || !botReady) return;
  const pos = bot.entity.position;
  positionHistory.push({ time: Date.now(), x: pos.x, y: pos.y, z: pos.z });
  // Keep last 60 seconds
  positionHistory = positionHistory.filter(p => Date.now() - p.time < 60000);
  
  // Check if stuck: position hasn't changed > 2 blocks in 30 seconds during active task
  if (currentTask && currentTask.status === 'running') {
    const oldest = positionHistory.find(p => Date.now() - p.time > STUCK_THRESHOLD);
    if (oldest) {
      const dist = Math.sqrt((pos.x - oldest.x) ** 2 + (pos.y - oldest.y) ** 2 + (pos.z - oldest.z) ** 2);
      if (dist < 2) {
        // STUCK! Cancel task and mark it
        bot.pathfinder.setGoal(null);
        try { bot.stopDigging(); } catch {}
        if (currentTask.status === 'running') {
          currentTask.status = 'stuck';
          currentTask.error = `Bot appears stuck at ${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)} — no movement for 30s`;
        }
        log('STUCK DETECTED! Task cancelled.');
      }
    }
  }
}, STUCK_CHECK_INTERVAL);
```

**Expose in briefState:**
```javascript
if (currentTask && currentTask.status === 'stuck') {
  state.task_stuck = currentTask.error;
}
```

**SOUL addition:**
```
## When Stuck
If you see `task_stuck` in a response, the bot couldn't complete the action:
1. Try a different approach (go around, mine through, find alternate path)
2. Use `mc screenshot` to see what's blocking you
3. If stuck in water/lava, try `mc jump` or `mc dig` downward
4. Tell the player: "I got stuck, trying a different route"
```

### Files to Modify
- `bot/server.js`: Add watchdog interval + stuck status (~30 lines)
- `SOUL-minecraft.md`: Add stuck recovery section (~10 lines)

---

## FEATURE 6: Sneak, Jump, Sprint Controls
**Priority**: MEDIUM-HIGH — needed for building + movement
**Effort**: Small

### Problem
No sneak (can't bridge-build on edges), no jump (can't get over 1-block gaps), no sprint toggle.

### Implementation

```javascript
// In ACTIONS:
async sneak({ enabled = true }) {
  const b = ensureBot();
  b.setControlState('sneak', enabled);
  return { result: enabled ? 'Sneaking' : 'Stopped sneaking' };
},

async jump() {
  const b = ensureBot();
  b.setControlState('jump', true);
  await sleep(500);
  b.setControlState('jump', false);
  return { result: 'Jumped' };
},

async sprint({ enabled = true }) {
  const b = ensureBot();
  b.setControlState('sprint', enabled);
  return { result: enabled ? 'Sprinting' : 'Stopped sprinting' };
},
```

**CLI commands:**
```
mc sneak [on|off]       # toggle sneaking
mc jump                 # jump once
mc sprint [on|off]      # toggle sprinting
```

### Files to Modify
- `bot/server.js`: Add 3 actions (~20 lines)
- `bin/mc`: Add 3 commands (~15 lines)

---

## FEATURE 7: Build Planner
**Priority**: MEDIUM-HIGH — makes building demos actually impressive
**Effort**: Medium-Large

### Problem
Building a cabin requires 200+ individual `mc place` commands with manually calculated coordinates. The AI can't visualize a 3D structure and place blocks correctly. Every build comes out ugly or wrong.

### Implementation

**New action: `build_structure`**

Accepts a simple structure definition and places all blocks:

```javascript
async build_structure({ structure, origin_x, origin_y, origin_z }) {
  const b = ensureBot();
  // structure is an array of { block, x, y, z } (relative to origin)
  // Sort by Y (bottom up), then place each block
  // Navigate near each placement position
  // Handle failures (can't place = skip, log)
  // Return { result: "Placed 180/200 blocks", failed: [...] }
}
```

**New action: `fill`** (simpler version)

```javascript
async fill({ block, x1, y1, z1, x2, y2, z2 }) {
  const b = ensureBot();
  // Fill a rectangular region with a block type
  // Iterate over all positions, place each
  // Navigate as needed
  // Great for floors, walls, roofs
}

async walls({ block, x1, y1, z1, x2, y2, z2, height }) {
  // Build walls around a rectangular perimeter
}

async clear({ x1, y1, z1, x2, y2, z2 }) {
  // Dig out all blocks in a region (clear terrain for building)
}
```

**CLI commands:**
```
mc fill BLOCK X1 Y1 Z1 X2 Y2 Z2         # fill a region
mc walls BLOCK X1 Y1 Z1 X2 Y2 Z2 HEIGHT  # build walls
mc clear X1 Y1 Z1 X2 Y2 Z2               # clear a region
mc build_structure '{json}'                # place from structure definition
```

**Pre-built templates (optional):**
Save common structures as JSON in `templates/`:
- `cabin_7x5.json` — simple cabin
- `tower_3x3.json` — watchtower
- `wall_segment.json` — defensive wall

The AI can load templates and customize them:
```
mc build_template cabin origin_x origin_y origin_z
```

### Files to Modify
- `bot/server.js`: Add fill, walls, clear, build_structure actions (~150 lines)
- `bin/mc`: Add CLI commands (~30 lines)
- Create: `templates/` directory with JSON structure files
- `skills/minecraft-building.md`: Update with new commands
- `SOUL-minecraft.md`: Reference build helpers

---

## FEATURE 8: WebSocket Event Stream
**Priority**: MEDIUM — eliminates polling
**Effort**: Medium

### Problem
Currently the AI must poll `mc read_chat` and `mc task` to see new events. This adds latency. For a truly responsive agent, events should push to the AI.

### Implementation

**WebSocket server alongside HTTP:**

```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: config.api.port + 1 }); // 3002

function broadcast(event) {
  const msg = JSON.stringify(event);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Hook into bot events:
bot.on('chat', (username, message) => {
  broadcast({ type: 'chat', from: username, message, time: Date.now() });
});

bot.on('health', () => {
  broadcast({ type: 'health', health: bot.health, food: bot.food });
});

bot.on('death', () => {
  broadcast({ type: 'death', position: posObj() });
});

// Task completion
// When background task finishes:
broadcast({ type: 'task_done', task_id: taskId, result });

// Damage taken
broadcast({ type: 'damage', amount, health: bot.health });

// Entity approach (mob within 8 blocks)
broadcast({ type: 'threat', entity: name, distance, position });
```

**New CLI command:**
```
mc events                  # stream events in real-time (WebSocket client)
mc listen [seconds]        # listen for events for N seconds, return all
```

**Alternative — simpler approach without WebSocket:**
Add a `/events` endpoint that returns new events since last poll (event log with sequence numbers):

```
GET /events?since=SEQUENCE_NUM → { events: [...], next_seq: N }
```

This is simpler and works with the existing `mc` CLI pattern. The AI calls `mc events` periodically and gets all events since the last call. No WebSocket dependency.

### Recommendation
Start with the simpler `/events` endpoint. Add WebSocket later if needed.

### Files to Modify
- `bot/server.js`: Add event log, `/events` endpoint (~50 lines)
- `bin/mc`: Add `events` command (~10 lines)

---

## FEATURE 9: Multi-Agent Support
**Priority**: MEDIUM — huge for the demo/vision angle
**Effort**: Small (it mostly works already)

### Problem
The architecture already supports multiple bots (run multiple server.js on different ports), but it's not documented, configured, or demonstrated.

### Implementation

**hermescraft.sh enhancements:**
```bash
# Support multiple agents
./hermescraft.sh                          # default: HermesBot on port 3001
./hermescraft.sh --name Builder --port 3002 --soul profiles/builder.md
./hermescraft.sh --name Miner --port 3003 --soul profiles/miner.md
```

**Personality profiles in `profiles/`:**
```
profiles/
├── companion.md       # Default: helpful, social, follows player
├── builder.md         # Building specialist, aesthetics focus
├── miner.md          # Resource gathering, efficiency focus
├── guard.md          # Combat specialist, patrols, protects
└── farmer.md         # Food production, breeding, farming
```

Each profile is a SOUL file variant with different priorities, personality, and knowledge emphasis.

**Inter-agent communication:**
Bots already see each other's chat messages in Minecraft. If Builder says "I need 20 cobblestone", Miner's AI sees it in `mc read_chat` and can respond. This is emergent multi-agent cooperation through the game's own chat system.

**New CLI support:**
```
mc chat_to PLAYER "message"    # whisper to specific player/bot
```

### Files to Modify
- `hermescraft.sh`: Add --name, --port, --soul flags (~20 lines)
- Create: `profiles/` directory with 3-5 personality SOULs
- `README.md`: Add multi-agent section

---

## FEATURE 10: State Persistence
**Priority**: MEDIUM — survive restarts
**Effort**: Small-Medium

### Problem
Everything is in memory. Server restart = total amnesia. Locations, death log, command queue — all gone.

### Implementation

**Auto-save state to `data/state.json` every 30 seconds:**
```javascript
const STATE_FILE = path.join(process.cwd(), '..', 'data', 'state.json');

function saveState() {
  if (!bot || !botReady) return;
  const state = {
    saved: Date.now(),
    position: posObj(),
    health: bot.health,
    food: bot.food,
    inventory: bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
    deaths: deathLog,
    locations: locations, // from coordinate memory
    chatLog: chatLog.slice(-50),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

setInterval(saveState, 30000);

// Load on startup
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch { return null; }
}
```

**New CLI command:**
```
mc save_state              # force save current state
mc load_state              # show last saved state
```

### Files to Modify
- `bot/server.js`: Add save/load state functions + interval (~50 lines)
- `bin/mc`: Add save_state/load_state commands (~10 lines)
- `.gitignore`: Add `data/` directory

---

# 6. SOUL & AI BEHAVIOR OVERHAUL

The SOUL file is the AI's brain programming. It needs to be comprehensive enough that the AI can handle ANY situation autonomously.

## Current SOUL Weaknesses (from audit)

1. No error recovery guidance
2. No combat decision tree
3. No inventory management strategy
4. No death recovery plan
5. Building instructions are aspirational but impractical
6. No awareness of bot limitations
7. No exploration strategy

## New SOUL Structure

The SOUL should be reorganized into these sections:

```
1. IDENTITY — who you are, how you act
2. COMMANDS — complete mc CLI reference
3. PLAYER INTERACTION — chat, commands, learning, memory
4. BACKGROUND TASKS — how to multitask
5. VISION — screenshots, visual verification
6. COMBAT — threat assessment, fight/flee, death recovery
7. BUILDING — terrain prep, construction, build helpers, style
8. RESOURCE MANAGEMENT — mining, crafting, inventory, chests
9. EXPLORATION — where to go, what to look for, marking locations
10. ERROR RECOVERY — what to do when things fail
11. KNOWN LIMITATIONS — what you CAN'T do
```

## Key Sections to Add/Rewrite

### Combat Decision Tree
```
THREAT ASSESSMENT:
  1. mc status → check nearby entities
  2. If creeper within 8 blocks → mc flee (they explode!)
  3. If hostile within 12 blocks → assess:
     - Do I have a weapon? If no → flee or craft one
     - Do I have armor? Better odds
     - HP > 10? → mc fight <target>
     - HP 6-10 with food? → mc eat, then fight
     - HP < 6? → mc flee, eat, reassess
  4. Multiple hostiles → fight the closest, retreat if HP drops
  5. ALWAYS tell the player: "zombie nearby, fighting it" or "creeper! running!"

AFTER COMBAT:
  - mc eat if HP < 16
  - mc pickup to grab drops
  - Check armor durability
```

### Death Recovery Protocol
```
WHEN YOU DIE:
  1. mc deaths → see where/when you died
  2. mc chat "I died! Running back for my stuff."
  3. If < 4 minutes ago:
     - mc bg_goto <death_x> <death_y> <death_z>
     - Poll mc task while traveling
     - mc pickup when arrived
  4. If > 5 minutes → items despawned
     - mc chat "Lost my stuff. Starting over."
     - Begin basic tool crafting
  5. mc mark last_death → save the dangerous spot
```

### Error Recovery Guide
```
WHEN THINGS FAIL:
  Pathfinder fails ("No path") →
    - Try mc goto_near instead of mc goto
    - Try digging through obstacles: mc dig X Y Z
    - If in water/lava: mc jump, try different direction
    - Take screenshot to see what's blocking

  Craft fails ("Missing ingredients") →
    - mc recipes ITEM → check what's needed
    - mc inventory → check what you have
    - Gather missing materials

  Collect fails ("No BLOCK found") →
    - Try larger search: mc find_blocks BLOCK 64
    - Move to a new area and try again
    - Try alternative blocks (birch_log instead of oak_log)

  Task stuck →
    - mc cancel
    - mc screenshot to see what happened
    - Try a different approach
    - Tell the player what went wrong
```

### Known Limitations
```
THINGS YOU CANNOT DO (don't try):
  - Transfer items to/from chests (interact only opens them) [UNTIL chest feature is added]
  - Use enchanting tables, brewing stands, anvils
  - Ride boats, minecarts, horses
  - Use shields to block
  - Shoot bows accurately
  - Write on signs or books
  - Trade with villagers
  - Use redstone mechanisms
  - Swim underwater for extended periods

THINGS THAT ARE TRICKY:
  - Building on edges (need mc sneak on first)
  - Placing blocks high up (may need to pillar up)
  - Fighting multiple mobs (fight one, flee if overwhelmed)
  - Long-distance travel (use mc bg_goto, check chat while traveling)
```

---

# 7. README & GITHUB PRESENTATION

## README Structure for Hackathon

The README needs to sell the VISION first, then show it works.

```markdown
# ⚡ HermesCraft — Embodied AI Companion for Minecraft

> MiroFish builds parallel worlds of AI agents. We put the agent IN the world.

HermesCraft connects AI to Minecraft — not as a scripted bot, but as a
thinking, learning, remembering companion. It chats with you, follows
your instructions, mines resources, builds structures, fights mobs, and
gets better over time. All through natural language in Minecraft chat.

**Built on [Hermes Agent](https://github.com/NousResearch/hermes-agent)** —
persistent memory, web access, vision, and 100+ tool integrations.

[DEMO VIDEO/GIF HERE]

## ✨ Key Features

- 🧠 **AI Brain, Not a Script** — LLM-powered decisions, not pattern matching
- 💾 **Persistent Memory** — teaches carry across sessions ("don't use dirt for walls")
- 👁 **Vision** — takes screenshots, analyzes builds, verifies work
- 🔄 **Multitasks** — mines in background while chatting with you
- ⚔️ **Survives** — fights mobs, eats food, recovers from death
- 🏗 **Builds With Taste** — terrain prep, multiple materials, actual aesthetics
- 🌐 **Web-Connected** — can look up crafting recipes, building ideas, anything
- 🤝 **Multi-Agent Ready** — run multiple AI personalities cooperating in one world

## 🎮 Quick Start
[...]

## 🏗 Architecture
[Architecture diagram from section 2]

## 🧩 How It Works
[Bot → CLI → Agent explanation]

## 🤖 Multi-Agent Mode
[Show 2+ agents cooperating]

## 🔮 Vision: AI in Virtual Worlds
[The MiroFish comparison, embodied AI, civilization building angle]

## 📊 Capabilities
[Table of everything the bot can do]

## 🛠 Contributing
[How to add actions, skills, personality profiles]
```

## GitHub Enhancements

1. **Demo GIF/Video** at the top of README (most important!)
2. **Architecture diagram** (Mermaid or ASCII art)
3. **GitHub Actions CI** (lint + syntax check)
4. **Issue templates** (bug report, feature request)
5. **CONTRIBUTING.md**
6. **LICENSE** (MIT)
7. **Releases** (tag v3.0.0)
8. **Topics**: `minecraft`, `ai-agent`, `mineflayer`, `llm`, `autonomous-agent`, `hermes`, `nous-research`

---

# 8. DEMO SCRIPT

## 3-Minute Hackathon Demo

### Setup (before demo)
- Minecraft running, LAN world open on known port
- HermesCraft running (hermescraft.sh)
- Terminal visible alongside Minecraft window
- Pre-set time to morning, cleared immediate area

### Script

**[0:00 - 0:30] The Hook**
"This is HermesCraft. That player right there? It's an AI. Same Hermes Agent that lives on Telegram and Discord — but now it has a body in Minecraft."

*Show bot following player, chatting naturally*

**[0:30 - 1:00] Natural Interaction**
Type in Minecraft chat: "hermes, let's build a cabin on that hill"

*Show the AI responding in chat, surveying terrain, starting to gather materials*

"It understands context. It plans. It gathers materials it needs. And watch this—"

**[1:00 - 1:30] Multitasking + Responsiveness**
*While bot is gathering wood in background*
Type: "hermes, there's a skeleton behind you!"

*Show bot stopping collection, fighting the skeleton, then resuming*

"It was collecting wood in the background. I interrupted it, it handled the threat, went back to work. That's because actions run asynchronously — the AI brain is always listening."

**[1:30 - 2:00] Learning + Memory**
Type: "hermes, use birch logs for the frame, not oak. I like the lighter color."

*Show bot acknowledging, switching materials*

"It just saved that preference to persistent memory. Next session — tomorrow, next week — it remembers. Teach it once."

**[2:00 - 2:30] Vision**
"The AI can also SEE what it builds."

*Show mc screenshot → vision_analyze in terminal*

"It takes screenshots of the game window, analyzes them with vision AI, and can self-correct. 'Does this look good? No, the roof needs work.'"

**[2:30 - 3:00] The Vision**
"Right now this is one agent in one world. But the architecture is game-agnostic — HTTP API, CLI, AI agent. The same pattern works for any game with a bot API.

And it supports multiple agents. Different personalities — a builder, a miner, a guard. They communicate through in-game chat. Emergent cooperation.

MiroFish simulates fake worlds to predict outcomes. We put AI in real ones. This is the foundation for persistent, embodied AI companions that learn, remember, and cooperate with humans.

HermesCraft. Open source. MIT license. Try it tonight."

---

# 9. TASK CHECKLIST

## Tier 1 — CRITICAL (Must-Do)

- [ ] **BUG-1**: Fix toss count parameter (server.js ~line 821)
- [ ] **BUG-2**: Fix kicked reconnect (server.js ~line 470)
- [ ] **BUG-3**: Fix chat log clearing race (server.js ~line 940)
- [ ] **BUG-4**: Add reconnect backoff (server.js ~line 478)
- [ ] **BUG-5**: Log collect errors instead of swallowing (server.js ~line 530)
- [ ] **BUG-6**: Fix config.mc.auth assignment (server.js line 60)
- [ ] **BUG-7**: Prevent background task overwrite (server.js ~line 988)
- [ ] **BUG-8**: Remove mineflayer-pvp from package.json
- [ ] **FEAT-1**: Sustained combat (fight + flee actions)
- [ ] **FEAT-2**: Death recovery (death tracking + /deaths endpoint)
- [ ] **FEAT-3**: Container interaction (deposit + withdraw + chest listing)
- [ ] **FEAT-4**: Coordinate memory (mark + marks + go_mark)
- [ ] **FEAT-5**: Stuck detection watchdog
- [ ] **SOUL-1**: Complete SOUL rewrite with all sections
- [ ] **SOUL-2**: Combat decision tree
- [ ] **SOUL-3**: Death recovery protocol
- [ ] **SOUL-4**: Error recovery guide
- [ ] **SOUL-5**: Known limitations section

## Tier 2 — HIGH VALUE

- [ ] **FEAT-6**: Sneak + Jump + Sprint controls
- [ ] **FEAT-7**: Build planner (fill, walls, clear)
- [ ] **FEAT-8**: Event stream (/events endpoint)
- [ ] **FEAT-9**: Multi-agent documentation + profiles
- [ ] **FEAT-10**: State persistence (auto-save state.json)
- [ ] **SKILL-1**: Rewrite all 5 skill files with new commands
- [ ] **CLI-1**: Add all new CLI commands
- [ ] **CLI-2**: Add `mc help` improvements (group by category)

## Tier 3 — PRESENTATION

- [ ] **README-1**: Complete README rewrite with vision framing
- [ ] **README-2**: Architecture diagram (Mermaid)
- [ ] **README-3**: Demo GIF/video recording
- [ ] **GH-1**: GitHub topics + description
- [ ] **GH-2**: Create v3.0.0 release tag
- [ ] **GH-3**: Issue templates
- [ ] **GH-4**: CONTRIBUTING.md
- [ ] **DOC-1**: API documentation (all endpoints)
- [ ] **DOC-2**: Profile system documentation

## Tier 4 — STRETCH GOALS

- [ ] **FEAT-11**: WebSocket real-time events
- [ ] **FEAT-12**: Build templates (JSON structure files)
- [ ] **FEAT-13**: Auto-equip best gear on spawn/craft
- [ ] **FEAT-14**: Farming automation (hoe, plant, harvest cycle)
- [ ] **FEAT-15**: Trading with villagers
- [ ] **FEAT-16**: Nether portal construction + navigation
- [ ] **FEAT-17**: prismarine-viewer integration (browser-based bot POV)
- [ ] **FEAT-18**: Voice integration (TTS for bot chat via Kokoro)
- [ ] **BENCH-1**: Performance benchmarks (blocks/min, response time)
- [ ] **BENCH-2**: Uptime/reliability testing (24h run)

---

# APPENDIX A: KEY FILE REFERENCES

When implementing, these are the exact locations to modify:

## bot/server.js (1077 lines)
- **Lines 1-65**: Imports, config, CLI arg parsing
- **Lines 66-75**: Global state variables (bot, mcData, chatLog, commandQueue, currentTask)
- **Lines 77-120**: Chat handling (handleChat, isAddressedToBot, stripBotName, commandQueue)
- **Lines 122-130**: log() function
- **Lines 132-260**: createBot() function (connection, plugin loading, event handlers)
- **Lines 262-300**: briefState() function (includes new_chat, pending_commands, task status)
- **Lines 302-450**: getFullState() function (full status response)
- **Lines 452-478**: ensureBot(), sleep(), fmt(), posObj(), itemStr() helpers
- **Lines 480-870**: ACTIONS object (all 24 action implementations)
  - 480-510: goto, goto_near, follow, look, stop
  - 512-568: collect (with batch cap + auto-pickup)
  - 569-600: dig, pickup
  - 601-660: find_blocks, find_entities, complete_command
  - 661-750: craft, recipes, smelt
  - 751-830: attack (single-hit), eat, equip, toss (BUGGY), place
  - 831-870: interact, close_screen, chat, wait, use, sleep_bed
- **Lines 872-910**: parseBody(), respond() HTTP helpers
- **Lines 912-955**: HTTP server GET endpoints
- **Lines 957-1040**: HTTP server POST endpoints (actions + tasks)
- **Lines 1042-1077**: Startup, error handlers

## bin/mc (571 lines)
- **Lines 1-90**: Header, arg parsing, API helpers (api_get, api_post, die)
- **Lines 95-245**: pretty() function (Python3 pretty printer)
- **Lines 247-570**: Command dispatch (case statement with all commands)

## SOUL-minecraft.md (177 lines)
- The entire AI behavior/personality definition
- Needs complete rewrite per Section 6

## hermescraft.sh (156 lines)
- Launcher script — starts bot + Hermes agent
- Needs --name, --port, --soul flag support for multi-agent

## setup.sh (185 lines)
- First-time setup (node check, npm install, verify)
- Probably fine as-is

---

# APPENDIX B: MINEFLAYER API QUICK REFERENCE

For implementing new features, these are the key Mineflayer APIs:

```javascript
// Movement
bot.setControlState('forward', true/false)
bot.setControlState('back', true/false)
bot.setControlState('left', true/false)
bot.setControlState('right', true/false)
bot.setControlState('jump', true/false)
bot.setControlState('sneak', true/false)
bot.setControlState('sprint', true/false)
bot.clearControlStates()

// Combat
bot.attack(entity)              // single hit
bot.swingArm('right'/'left')    // swing animation
bot.activateItem()              // right-click with held item (shield raise)
bot.deactivateItem()            // stop using item

// Inventory
bot.equip(item, destination)    // 'hand', 'off-hand', 'head', 'torso', 'legs', 'feet'
bot.unequip(destination)
bot.toss(itemType, metadata, count)  // drop specific amount
bot.tossStack(item)             // drop entire stack

// Containers
const chest = await bot.openContainer(block)
chest.containerItems()          // items in container
await chest.deposit(type, meta, count)
await chest.withdraw(type, meta, count)
chest.close()

// World
bot.blockAt(position)           // get block at coords
bot.findBlocks({ matching, maxDistance, count })
bot.canDigBlock(block)
bot.dig(block, forceLook)
bot.placeBlock(referenceBlock, faceVector)

// Events
bot.on('chat', (username, message) => {})
bot.on('health', () => {})
bot.on('death', () => {})
bot.on('kicked', (reason) => {})
bot.on('end', (reason) => {})
bot.on('entityHurt', (entity) => {})
bot.on('entityGone', (entity) => {})
bot.on('spawn', () => {})
bot.on('move', () => {})
bot.on('entityMoved', (entity) => {})

// Pathfinder
const { GoalBlock, GoalNear, GoalFollow, GoalXZ, GoalY, GoalInvert } = goals;
bot.pathfinder.setGoal(goal, dynamic)  // dynamic=true for moving targets
await bot.pathfinder.goto(goal)        // await completion
bot.pathfinder.setMovements(movements) // configure allowed movements
```

---

# APPENDIX C: TESTING PROTOCOL

## Quick Smoke Test
After each change, verify:
```bash
cd ~/hermescraft/bot && node -c server.js  # syntax check
MC_PORT=<port> ./hermescraft.sh --bot-only  # start bot only
mc status                                    # verify connection
mc chat "test"                               # verify chat
mc collect oak_log 3                         # verify pathfinder + mining
mc bg_collect oak_log 5                      # verify background tasks
mc task                                      # verify task polling
mc cancel                                    # verify cancellation
```

## Feature-Specific Tests
Each feature should be tested independently:
- **Combat**: Spawn a zombie with `/summon zombie`, test `mc fight zombie`
- **Death**: Kill the bot, verify `mc deaths` shows correct data
- **Chests**: Place a chest, test deposit/withdraw
- **Marks**: Save location, restart bot, verify marks persist
- **Stuck**: Send bot to unreachable location, verify watchdog triggers
- **Sneak**: Test edge-building with sneak enabled
- **Build helpers**: Test `mc fill cobblestone X1 Y1 Z1 X2 Y2 Z2`

---

---

# APPENDIX D: HERMES AGENT — COMPLETE CONTEXT

This section ensures anyone implementing this plan understands EXACTLY how Hermes Agent works. DO NOT HALLUCINATE HERMES FEATURES. Reference ONLY what is documented here.

## What Hermes Agent IS

Hermes Agent is an open-source autonomous AI assistant by Nous Research. It's a CLI tool (`hermes`) that gives an LLM access to tools (terminal, file editing, web search, browser, vision, memory, etc.) and lets it act autonomously.

- **GitHub**: https://github.com/NousResearch/hermes-agent
- **Install**: `pip install hermes-agent`
- **Version on this system**: v0.2.0 (2026.3.12)
- **Config location**: `~/.hermes/config.yaml`
- **SOUL file**: `~/.hermes/SOUL.md` (personality/system prompt injected into every conversation)
- **Skills**: `~/.hermes/skills/` (reusable knowledge files loaded on matching triggers)
- **Memory**: `~/.hermes/MEMORY.md` (persistent notes) + `~/.hermes/USER.md` (user profile)
- **Sessions**: Stored locally, searchable via FTS5 full-text search

## How Hermes Runs in HermesCraft

The `hermescraft.sh` launcher does this:
1. Starts the bot server (`node bot/server.js`) in background
2. Waits for bot to connect to Minecraft
3. Backs up existing `~/.hermes/SOUL.md`, replaces with `SOUL-minecraft.md`
4. Runs: `hermes chat --yolo -q "You're in Minecraft with a friend..."`
5. On exit, restores original SOUL.md

The `--yolo` flag bypasses dangerous command approval prompts (since mc CLI commands are safe).
The `-q` flag runs in single-query non-interactive mode.

Hermes then autonomously calls terminal commands (`mc status`, `mc collect`, etc.) in a loop, making decisions based on the SOUL instructions and what it sees.

## Hermes CLI — Key Commands

```bash
hermes chat                           # interactive chat
hermes chat -q "query"                # single query, non-interactive
hermes chat --yolo -q "query"         # single query, no approval prompts
hermes chat -m MODEL -q "query"       # use specific model
hermes chat --yolo --resume SESSION   # resume a previous session
hermes chat -c                        # continue most recent session
hermes chat -t terminal,file -q "x"   # limit to specific toolsets
```

## Hermes Tools Available to the Agent

When Hermes runs, the LLM has access to these tools (the same ones listed at the top of this plan):

**Terminal**: Execute shell commands. This is how mc CLI commands are run.
**File tools**: read_file, write_file, patch, search_files
**Web**: web_search, web_extract
**Browser**: Navigate, click, type in web pages
**Vision**: vision_analyze — analyze images with AI (used for mc screenshot)
**Memory**: Persistent key-value store. `memory(action="add", target="memory", content="...")`
  - Survives across sessions
  - Injected into system prompt on every turn
  - Two stores: "memory" (agent notes) and "user" (user profile)
  - Max ~2200 chars for memory, ~1375 chars for user
**Session Search**: `session_search(query="...")` — search past conversations via FTS5
**Skills**: Load reusable knowledge files that match task triggers
**Todo**: In-session task list management
**Delegation**: Spawn sub-agents for parallel work
**TTS**: Text to speech (Kokoro TTS available on port 8880)

## Hermes Memory System — How It Works

This is CRITICAL for the "learning" feature of HermesCraft.

The agent has TWO persistent text files:
- `~/.hermes/MEMORY.md` — agent's notes (environment, lessons learned, conventions)
- `~/.hermes/USER.md` — user profile (name, preferences, role)

Both are injected into the system prompt on EVERY turn. The agent can:
```
memory(action="add", target="memory", content="MC lesson: Don't place crafting tables outside")
memory(action="replace", target="memory", old_text="Don't place crafting tables", content="MC lesson: Place crafting tables and furnaces INSIDE buildings only")
memory(action="remove", target="memory", old_text="MC lesson")
```

**Constraints:**
- Memory is plain text, NOT vector/semantic search
- Max 2200 chars for memory, 1375 chars for user profile
- Content is additive — each `add` appends a new entry
- Entries are separated by `§` markers
- Memory is shared across ALL Hermes sessions (Telegram, CLI, etc.)
- When HermesCraft saves a Minecraft lesson, it persists and is visible in Telegram chats too

**For HermesCraft, memory should store:**
- Building preferences ("player likes birch logs for cabin frames")
- Base locations ("home base at X=100 Y=64 Z=-200")
- Player name and preferences
- Lessons learned ("creepers explode, always flee")
- World-specific notes ("iron mine at Y=16 near base")

**WARNING:** Memory is limited to 2200 chars. Don't store verbose data. Keep entries compact.

## Hermes Session Search

The agent can search past conversations:
```
session_search(query="minecraft building cabin")
```
Returns summaries of matching past sessions. Useful for recalling what happened in previous play sessions.

## Hermes Skills System

Skills are markdown files in `~/.hermes/skills/CATEGORY/SKILL_NAME/SKILL.md`. They have YAML frontmatter with triggers, and markdown body with instructions.

When the user's message matches a skill's triggers, the skill is auto-loaded into context. Skills can also be manually loaded.

**HermesCraft installs these skills:**
- `gaming/minecraft-survival/SKILL.md`
- `gaming/minecraft-combat/SKILL.md`
- `gaming/minecraft-building/SKILL.md`
- `gaming/minecraft-farming/SKILL.md`
- `gaming/minecraft-navigation/SKILL.md`

The setup.sh script copies skills from `hermescraft/skills/` to `~/.hermes/skills/gaming/`.

## Hermes SOUL File

The SOUL file (`~/.hermes/SOUL.md`) is a system prompt override. It's injected at the TOP of every conversation, before any user message. It defines:
- Who the agent is
- How it should behave
- What tools/commands it has
- Decision-making rules

**In HermesCraft, hermescraft.sh temporarily replaces the global SOUL with SOUL-minecraft.md** during play, and restores the original on exit.

The SOUL is the MOST IMPORTANT file for gameplay quality. It's what determines whether the AI plays well or gets stuck in loops.

## Hermes Config — Current Setup on This Machine

```yaml
model:
  default: claude-opus-4-6
  provider: anthropic
toolsets: [all]
agent:
  max_turns: 100
terminal:
  backend: local
  timeout: 180
memory:
  memory_enabled: true
  user_profile_enabled: true
  memory_char_limit: 2200
  user_char_limit: 1375
compression:
  enabled: true
  threshold: 0.9
  summary_model: google/gemini-3-flash-preview
```

## How the mc CLI Gets Used

The Hermes agent runs in a terminal. When it decides to check status, it literally runs:
```bash
mc status
```
in the terminal tool, reads the output, and makes decisions based on it. Same for all mc commands. The agent sees the human-readable output from the `pretty()` function in `bin/mc`.

This means:
1. The `mc` CLI output format matters — it's what the AI reads
2. New fields in briefState() need to be printed by pretty() or the AI won't see them
3. JSON mode (`--json`) exists but the AI uses human-readable by default
4. The `mc` binary must be on PATH (hermescraft.sh adds bin/ to PATH and symlinks to ~/.local/bin/mc)

## What Hermes CANNOT Do

- **No MCP tools for Minecraft** — we removed the MCP approach. Everything goes through `mc` CLI via terminal.
- **No real-time event push** — the agent must poll (mc read_chat, mc task, etc.)
- **No parallel tool calls while waiting** — if the agent runs `mc collect oak_log 20` (sync), it blocks until done. Background tasks (`mc bg_collect`) return instantly.
- **No direct Mineflayer API access** — everything goes through the HTTP API on port 3001
- **Memory is limited to 2200 chars** — can't store a novel
- **Max 100 turns per session** — then the session ends (configurable in config.yaml)
- **No image generation** — vision_analyze can READ images but not create them

## Environment Details

- **OS**: Ubuntu 24.04
- **CPU**: i7-12700F
- **RAM**: 62GB
- **GPU**: NVIDIA T1000 8GB (not used by Hermes/Mineflayer)
- **Node.js**: v24.11.1
- **Python**: 3.11.14
- **Minecraft**: Java Edition 1.21.11 via Prism Launcher (Flatpak)
- **Hermes**: v0.2.0
- **Default LLM**: claude-opus-4-6 via Anthropic API

---

# APPENDIX E: FULL SOURCE FILE CONTENTS

For opus to have complete context without needing to read files.

## hermescraft.sh (156 lines) — The Launcher

Key behavior:
1. Starts bot server (node server.js) with MC_HOST, MC_PORT, MC_USERNAME, API_PORT env vars
2. Bot log goes to /tmp/hermescraft-bot.log
3. Waits up to 20s for bot HTTP API to respond
4. Waits up to 30s for Minecraft connection
5. Backs up ~/.hermes/SOUL.md, copies SOUL-minecraft.md in its place
6. Runs: `exec hermes chat --yolo -q "PROMPT"`
7. On exit (trap): kills bot server, restores SOUL.md

The `exec` means the hermes process REPLACES the shell. When hermes exits, the script's trap runs cleanup.

## Bot Server Startup Flow

1. Parse config from env vars + CLI args
2. `createBot()` → Mineflayer connects to MC server
3. On 'spawn' event:
   - Load plugins (pathfinder, armor-manager, auto-eat, collectblock)
   - Configure pathfinder movements
   - Configure auto-eat (eat at food < 14)
   - Set up event handlers (chat, health, death, kicked, end)
4. Start HTTP server on API_PORT (default 3001)
5. On disconnect: auto-reconnect after 5s

## Important: How the AI Agent Loop Works

When hermescraft.sh starts hermes with the prompt, hermes enters an autonomous loop:
1. Reads the SOUL (from ~/.hermes/SOUL.md — which is now SOUL-minecraft.md)
2. Executes the initial query: "You're in Minecraft with a friend..."
3. The AI decides to run `mc status` (as instructed by the SOUL)
4. Reads the output, decides what to do next
5. Runs more mc commands based on what it sees
6. Checks chat, responds to player, executes tasks
7. This continues for up to 100 turns (max_turns in config)
8. Each "turn" is one AI response that may include multiple tool calls

The AI's behavior quality is 100% determined by:
- The SOUL file (behavior rules, command reference, decision trees)
- The skill files (loaded when triggered)
- The memory (lessons learned from past sessions)
- The LLM model quality (claude-opus-4-6 is excellent)

---

# APPENDIX F: USEFUL LINKS

- **Hermes Agent GitHub**: https://github.com/NousResearch/hermes-agent
- **Hermes Agent Docs/Wiki**: https://github.com/NousResearch/hermes-agent/wiki (if available)
- **Mineflayer GitHub**: https://github.com/PrismarineJS/mineflayer
- **Mineflayer API Docs**: https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md
- **Mineflayer Pathfinder**: https://github.com/PrismarineJS/mineflayer-pathfinder
- **minecraft-data**: https://github.com/PrismarineJS/minecraft-data
- **MiroFish GitHub**: https://github.com/666ghj/MiroFish
- **Project Sid Paper**: https://arxiv.org/abs/2411.10935
- **Voyager Paper**: https://arxiv.org/abs/2305.16291
- **Mindcraft GitHub**: https://github.com/mindcraft-bots/mindcraft

END OF PLAN
