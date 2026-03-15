#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft — Multi-Agent Launcher
#
# Starts multiple AI agents in one Minecraft world.
# Each agent gets its own bot process and Hermes instance.
#
# Usage:
#   ./multi_launch.sh                     # 2 agents
#   ./multi_launch.sh 3                   # 3 agents
#   ./multi_launch.sh "Build a base" 3    # 3 agents with goal
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

NAMES=("HermesBot" "Athena" "Apollo" "Artemis" "Hermes2")
BASE_PORT=3001
GOAL="${1:-}"
NUM_AGENTS="${2:-2}"
PIDS=()
SOUL_BACKUP=""

# Handle SOUL.md once here to avoid race between multiple hermescraft.sh
SOUL_FILE="$HOME/.hermes/SOUL.md"
if [ -f "$SOUL_FILE" ]; then
    SOUL_BACKUP="$SOUL_FILE.multi-bak"
    cp "$SOUL_FILE" "$SOUL_BACKUP"
fi
cp "$SCRIPT_DIR/SOUL-minecraft.md" "$SOUL_FILE"

cleanup() {
    echo ""
    echo "  Shutting down all agents..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    # Restore original SOUL
    [ -n "$SOUL_BACKUP" ] && [ -f "$SOUL_BACKUP" ] && mv "$SOUL_BACKUP" "$SOUL_FILE"
    echo "  All agents stopped."
}
trap cleanup EXIT INT TERM

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   HERMESCRAFT — MULTI-AGENT MODE      ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

for i in $(seq 0 $((NUM_AGENTS - 1))); do
    NAME="${NAMES[$i]:-Agent$i}"
    PORT=$((BASE_PORT + i))

    echo "  Starting $NAME on port $PORT..."

    # Use --bot-only style: start bot server directly, then hermes separately
    # This avoids each hermescraft.sh fighting over SOUL.md
    MC_USERNAME="$NAME" API_PORT="$PORT" \
        "$SCRIPT_DIR/hermescraft.sh" --name "$NAME" --port "$PORT" ${GOAL:+"$GOAL"} &
    PIDS+=($!)

    sleep 3  # stagger to avoid connection races
done

echo ""
echo "  ═══════════════════════════════════════"
echo "  $NUM_AGENTS agents launched!"
echo "  Names: ${NAMES[@]:0:$NUM_AGENTS}"
echo "  Ports: $(seq -s ', ' $BASE_PORT $((BASE_PORT + NUM_AGENTS - 1)))"
echo "  Press Ctrl+C to stop all."
echo "  ═══════════════════════════════════════"
echo ""

wait
