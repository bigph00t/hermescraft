#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft Arena Launcher
# 
# Launches the arena coordinator and optionally starts a match.
# The arena coordinator handles starting individual bot servers.
#
# Usage:
#   ./arena_launch.sh              # Start coordinator (5v5 default)
#   ./arena_launch.sh 10           # 10v10 match
#   ./arena_launch.sh 3 10 30      # 3v3, 10 min, first to 30 kills
#
# Prerequisites:
#   - Minecraft server running on localhost:25565
#   - Node.js with mineflayer installed (cd bot && npm install)
#   - Allow offline-mode players or use a server with no auth
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TEAM_SIZE="${1:-5}"
DURATION="${2:-15}"
SCORE_LIMIT="${3:-50}"

echo "╔═══════════════════════════════════════════╗"
echo "║       HermesCraft Arena Launcher          ║"
echo "╠═══════════════════════════════════════════╣"
echo "║  Teams:      ${TEAM_SIZE}v${TEAM_SIZE}                          ║"
echo "║  Duration:   ${DURATION} minutes                       ║"
echo "║  Score Limit: ${SCORE_LIMIT} kills                      ║"
echo "╚═══════════════════════════════════════════╝"

# Check prereqs
if ! command -v node &>/dev/null; then
    echo "ERROR: node not found. Install Node.js first."
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/bot/node_modules/mineflayer" ]; then
    echo "Installing bot dependencies..."
    cd "$SCRIPT_DIR/bot" && npm install
    cd "$SCRIPT_DIR"
fi

# Ensure data dir exists
mkdir -p "$SCRIPT_DIR/data"

echo ""
echo "Starting Arena Coordinator..."
echo "Once running, use these commands:"
echo "  curl -X POST http://localhost:3100/setup   # Create teams + connect bots"
echo "  curl -X POST http://localhost:3100/start   # Begin battle!"
echo "  curl http://localhost:3100/status           # Check scores"
echo "  curl -X POST http://localhost:3100/stop     # End match"
echo ""
echo "Or launch Hermes agents for each bot:"
MAX_PORT=$((3000 + TEAM_SIZE * 2))
echo "  # For each bot port (3001, 3002, ..., $MAX_PORT):"
echo "  MC_API_URL=http://localhost:PORT hermes chat --yolo -q 'Play Minecraft as TEAM ROLE...'"
echo ""

exec node arena.js --teams "$TEAM_SIZE" --duration "$DURATION" --score "$SCORE_LIMIT"
