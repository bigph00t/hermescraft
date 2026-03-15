# HermesCraft Arena — 10v10 AI Battle System

## Vision

20 Hermes agents. 2 teams. 1 Minecraft server. Pure emergent gameplay.

Not scripted bots following waypoints — actual AI agents making tactical decisions,
flanking, ambushing, communicating, learning from deaths. Each agent runs its own
Hermes instance with the mc CLI, seeing the world through the same lens a player
would (with fair-play constraints).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Minecraft Server                     │
│            (Paper/Fabric, 20 players)                │
└────────────────────┬────────────────────────────────┘
                     │ 20 connections
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌─────────┐    ┌─────────┐
│ Bot Srv  │   │ Bot Srv  │    │ Bot Srv  │  × 20 (ports 3001-3020)
│ :3001    │   │ :3002    │    │ :3020    │
│ AgentRed1│   │ AgentRed2│    │BlueCmdr  │
└────┬─────┘   └────┬─────┘    └────┬─────┘
     │              │               │
     ▼              ▼               ▼
┌─────────┐   ┌─────────┐    ┌─────────┐
│ Hermes  │   │ Hermes  │    │ Hermes  │  × 20 agent instances
│ Agent   │   │ Agent   │    │ Agent   │
└─────────┘   └─────────┘    └─────────┘
     │
     ▼
┌──────────────────────────────────────┐
│         Arena Coordinator            │
│  (arena.js — manages teams, scores,  │
│   match lifecycle, spectator feed)   │
└──────────────────────────────────────┘
```

Each bot server runs on its own port with a unique MC_USERNAME.
Each Hermes agent gets a team assignment + role via its SOUL prompt.

## Fair Play Philosophy

### The Problem
Mineflayer gives bots GODLIKE awareness:
- See every entity through walls (X-ray)
- Know exact health of hidden players
- Perfect coordinate knowledge of everything
- Instant reaction time
- Can mine in total darkness

This makes PvP boring. An ambush can never work. Stealth is pointless.
Sneaking (which hides nameplates) does literally nothing.

### The Solution: Perception Constraints

**Line-of-Sight (LOS) Detection:**
- Entities behind solid blocks are HIDDEN from the bot's state
- Sneaking players detected only within 8 blocks (vs 48 normally)
- Must raycast from bot eyes to entity center — blocked = invisible
- Darkness penalty: detection range halved underground without torches

**Sound Simulation:**
- Mining, sprinting, combat sounds "heard" within radius
- Breaking blocks = 16 block sound radius
- Sprinting = 8 blocks
- Walking = 4 blocks, sneaking = 1 block
- Gives directional hints without exact positions

**Reaction Delay:**
- 100-300ms random delay before combat actions
- Prevents frame-perfect blocking/attacks
- Simulates human reaction time

**Limited Scan Range:**
- Block scanning limited to 16 blocks (not 64)
- Entity awareness limited to 32 blocks with LOS check
- Inventory of other players NOT visible

## Combat Improvements

### Current Issues
1. `attack` = single hit, must be called repeatedly → clunky
2. `fight` = sustained but no tactics — just chase and hit
3. No shield blocking
4. No bow/ranged combat  
5. No critical hits (jump attacks)
6. No sprint attacks (knockback)
7. No sneaking/stealth
8. No strafing/dodging

### New Combat Actions

**`sneak(enable)`** — Toggle sneak. Hides nameplate, reduces detection range.
Actually matters now with LOS system.

**`shield_block(duration)`** — Raise shield for N seconds. Blocks arrows and
reduces melee damage. Must have shield equipped in offhand.

**`shoot(target, predict)`** — Bow attack. Charges bow, leads target based on
distance and movement. `predict=true` for leading shots.

**`sprint_attack(target)`** — Sprint toward target, hit with knockback bonus.
Real MC mechanic — sprinting first hit deals extra knockback.

**`critical_hit(target)`** — Jump + attack for 150% damage. Must time the
falling part of the jump. The server action handles the timing.

**`strafe(target, direction, duration)`** — Circle-strafe around target while
attacking. Left/right/random. Good for avoiding arrows.

**`combo(target, style)`** — Pre-built combat sequences:
  - `"aggressive"` — sprint attack → crit → crit → shield
  - `"defensive"` — shield block → counter-hit → retreat → repeat
  - `"ranged"` — shoot → shoot → sprint attack if close
  - `"berserker"` — sprint → crit → crit → crit (no defense)

### New Combat Passive: Auto-Shield
When `auto_shield` is enabled and bot takes damage while holding shield:
- 40% chance to block next hit (simulates human reaction)
- Increases to 70% if already in combat stance

## Smelting Rework

### Current Issue
`smelt` blocks for up to 30 seconds waiting for output. A stack of 64 iron ore
takes ~640 seconds (10+ minutes). Bot just stands there doing nothing.

### New Approach: Fire-and-Forget Furnace

**`smelt_start(input, fuel, count)`** — Load furnace with input + fuel, return
immediately. Stores furnace location for later retrieval.

**`furnace_check(x, y, z)`** — Check furnace status without taking items.
Returns: input remaining, fuel remaining, output ready, ETA.

**`furnace_take(x, y, z)`** — Take all output from furnace. Can be combined
with `furnace_check` → go do other stuff → `furnace_take` when ready.

**`smelt_batch(input, fuel_per_batch, count)`** — Smart version: loads max fuel
+ input, estimates completion time, tells the AI when to come back.

This means the agent can:
1. Load 64 raw_iron + 8 coal into furnace
2. Go mine more stuff / build / fight for 10 minutes
3. Come back and collect 64 iron ingots

## Team System

### Team Structure (10v10)
```
RED TEAM                    BLUE TEAM
─────────                   ──────────
Commander (1)               Commander (1)
  - Sets strategy            - Sets strategy
  - Coordinates squad        - Coordinates squad

Warriors (4)                Warriors (4)
  - Front-line combat        - Front-line combat
  - Sprint attacks           - Sprint attacks

Rangers (3)                 Rangers (3)
  - Bow + arrows             - Bow + arrows
  - Flanking positions       - Flanking positions

Support (2)                 Support (2)
  - Build fortifications     - Build fortifications
  - Supply gear/food         - Supply gear/food
```

### Team Communication
- `mc team_chat "message"` — only your team can see (via /msg chain or scoreboard)
- `mc team_status` — see all teammates' health, position, role
- `mc rally X Y Z` — commander sets rally point for team
- `mc report "enemy spotted north"` — report to team

### Kill Tracking & Scoring
- Kills, deaths, assists tracked per player
- Team score = total kills
- Match ends at score limit or time limit
- Stats saved to `data/match_history.json`

## Match Lifecycle

### Pre-Match (2 min)
1. Arena coordinator assigns teams + spawns
2. Each team gets a base area with chest of starting gear
3. Barrier wall between teams
4. Agents can craft, strategize, communicate

### Battle Phase (configurable, default 15 min)
1. Barriers drop
2. Teams fight with respawns (5-second respawn delay)
3. Score tracked in real-time
4. Agents use full tactical AI

### Post-Match
1. Final scores displayed
2. MVP calculated (most kills, least deaths, most assists)
3. Stats saved
4. Option to rematch or reconfigure

## Multi-Agent Launch

### Resource Requirements
Each bot server + Hermes agent needs:
- ~200MB RAM for the bot (Node.js + Mineflayer)
- ~50MB for the Hermes CLI process
- 1 API call per agent action (to LLM)
- 20 agents = ~5GB RAM total for bots
- LLM calls: ~2-4 per agent per second during combat

For local: 20 agents on a single machine is feasible for the bot servers.
The Hermes agents can run against any LLM endpoint (local Ollama or cloud).

### Launch Script: `arena_launch.sh`
```bash
#!/bin/bash
# Launch 20 bot servers (ports 3001-3020)
# Then 20 Hermes agents with team-specific SOULs
# Arena coordinator on port 3100

# Team names
RED_NAMES=(RedCmdr RedWarrior1 RedWarrior2 RedWarrior3 RedWarrior4 RedRanger1 RedRanger2 RedRanger3 RedSupport1 RedSupport2)
BLUE_NAMES=(BlueCmdr BlueWarrior1 BlueWarrior2 BlueWarrior3 BlueWarrior4 BlueRanger1 BlueRanger2 BlueRanger3 BlueSupport1 BlueSupport2)

for i in {0..9}; do
  PORT=$((3001 + i))
  MC_USERNAME="${RED_NAMES[$i]}" API_PORT=$PORT node bot/server.js &
done
for i in {0..9}; do
  PORT=$((3011 + i))
  MC_USERNAME="${BLUE_NAMES[$i]}" API_PORT=$PORT node bot/server.js &
done
```

## File Changes Required

### server.js additions:
- [ ] LOS raycast function for entity filtering
- [ ] Sound simulation system
- [ ] Reaction delay on combat actions
- [ ] `sneak`, `shield_block`, `shoot`, `sprint_attack`, `critical_hit`, `strafe`, `combo` actions
- [ ] `smelt_start`, `furnace_check`, `furnace_take` actions
- [ ] `team_chat`, `team_status`, `rally`, `report` actions  
- [ ] Fair-play entity filtering in `getFullState()` and `getNearby()`
- [ ] Team assignment endpoint
- [ ] Kill/death/assist tracking

### mc CLI additions:
- [ ] All new commands mapped
- [ ] `mc sneak on/off`
- [ ] `mc shield [duration]`
- [ ] `mc shoot [target]`
- [ ] `mc sprint_attack [target]`
- [ ] `mc crit [target]`
- [ ] `mc strafe [target] [direction]`
- [ ] `mc combo [target] [style]`
- [ ] `mc smelt_start INPUT [fuel] [count]`
- [ ] `mc furnace_check X Y Z`
- [ ] `mc furnace_take X Y Z`
- [ ] `mc team_chat "msg"`
- [ ] `mc team_status`
- [ ] `mc rally X Y Z`
- [ ] `mc report "msg"`

### New files:
- [ ] `arena.js` — match coordinator
- [ ] `arena_launch.sh` — multi-agent launcher
- [ ] `souls/red-commander.md`, `souls/red-warrior.md`, etc.
- [ ] `data/match_history.json`
