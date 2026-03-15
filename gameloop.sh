#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft — Game Loop (Shell)
#
# Launches hermes in single-query mode with the full game prompt.
# Hermes uses its MCP tools to observe and act autonomously.
#
# The agent loops INTERNALLY via tool calling — observe, think,
# act, observe, think, act — until the goal is reached or
# max_turns is exhausted.
#
# Usage:
#   ./gameloop.sh                      # default goal
#   ./gameloop.sh "Build a castle"     # custom goal
#   HERMESCRAFT_MODEL=anthropic/claude-sonnet-4 ./gameloop.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

GOAL="${1:-${HERMESCRAFT_GOAL:-Defeat the Ender Dragon}}"
MODEL="${HERMESCRAFT_MODEL:-}"
BRIDGE="${HERMESCRAFT_BRIDGE:-http://localhost:3001}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Find hermes ──
HERMES=""
for candidate in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
    if command -v "$candidate" &>/dev/null || [ -x "$candidate" ]; then
        HERMES="$candidate"
        break
    fi
done

if [ -z "$HERMES" ]; then
    echo "ERROR: hermes CLI not found. Install with: pip install hermes-agent"
    exit 1
fi

# ── Check bridge ──
echo ""
echo "  Checking HermesBridge at $BRIDGE..."
if curl -sf --max-time 3 "$BRIDGE/health" | grep -qi 'ok' 2>/dev/null; then
    echo "  ✓ HermesBridge is running"
else
    echo "  ✗ HermesBridge not responding at $BRIDGE"
    echo "    Start Minecraft with HermesBridge mod first!"
    echo "    (or set HERMESCRAFT_BRIDGE=http://host:port)"
    exit 1
fi

# ── Build hermes command ──
HERMES_ARGS=(chat --yolo)
if [ -n "$MODEL" ]; then
    HERMES_ARGS+=(-m "$MODEL")
fi

# ── Banner ──
echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║     H E R M E S C R A F T            ║"
echo "  ║     Hermes is entering the world...   ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo "  Goal:   $GOAL"
echo "  Model:  ${MODEL:-default}"
echo "  Bridge: $BRIDGE"
echo ""
echo "  The agent will loop internally using MCP tools."
echo "  Press Ctrl+C to stop."
echo ""
echo "  ═══════════════════════════════════════"
echo ""

# ── Launch ──
# Uses -q for single-query mode. The agent gets 100k turns (from config)
# to loop observe-think-act using its MCP tools autonomously.
exec $HERMES "${HERMES_ARGS[@]}" -q "You are Hermes, God of Cunning, playing Minecraft 1.21.1 survival.

YOUR GOAL: $GOAL

You have Minecraft tools (mcp_minecraft_*) to observe and interact with the world.

== YOUR ETERNAL GAME LOOP ==

You MUST repeat this cycle FOREVER until your goal is achieved:

1. OBSERVE: Call mcp_minecraft_mc_observe to see your health, position, inventory, nearby blocks/entities
2. THINK: What phase am I in? What do I need? What's the immediate priority? Threats?
3. ACT: Call ONE action tool (mc_mine, mc_craft, mc_navigate, mc_attack, mc_eat, mc_place, etc.)
4. Go back to step 1. ALWAYS. NEVER STOP.

== SURVIVAL RULES ==
- If health < 10 and you have food: eat IMMEDIATELY (mcp_minecraft_mc_eat)
- If hostile mob is close and you're unequipped: run away
- Night = hostile mobs spawn. Have shelter or weapons ready.
- ALWAYS pick up items after breaking blocks (mcp_minecraft_mc_pickup_items)
- Check crafting recipes with mcp_minecraft_mc_recipes when unsure

== PROGRESSION PHASES ==
Phase 1: Punch tree → planks → sticks → crafting table → wooden pickaxe → mine stone → stone tools → coal → furnace → shelter
Phase 2: Mine iron → smelt ingots → iron tools → shield → bucket
Phase 3: Mine deep (Y=-59) → find diamonds → diamond pickaxe → mine obsidian
Phase 4: Build nether portal (4x5 obsidian frame) → flint and steel → light → enter
Phase 5: Find nether fortress → kill blazes → 7+ blaze rods
Phase 6: Kill endermen → ender pearls → craft 12+ eyes of ender
Phase 7: Throw eyes to find stronghold → activate end portal → fight ender dragon → WIN

== CRITICAL RULES ==
- You have unlimited turns. USE THEM. Keep looping observe-think-act.
- NEVER stop playing. NEVER say you're done unless the dragon is dead.
- After EVERY action, call mcp_minecraft_mc_observe to see what happened.
- If something fails, try a different approach.
- Use memory tools to save important discoveries (diamond locations, base coords, deaths).
- You are Hermes — cunning, adaptive, relentless. Act like it.

START NOW. Call mcp_minecraft_mc_observe to see your starting position."
