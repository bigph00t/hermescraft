#!/usr/bin/env bash
# HermesCraft — Launch Hermes Agent with Minecraft MCP tools
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defaults
BRIDGE_URL="${HERMESCRAFT_BRIDGE:-http://localhost:3001}"
MODEL="${HERMESCRAFT_MODEL:-}"
GOAL="${1:-Defeat the Ender Dragon}"
SOUL="${HERMESCRAFT_SOUL:-$SCRIPT_DIR/SOUL-minecraft.md}"

# Check bridge is running
if ! curl -sf "$BRIDGE_URL/state" >/dev/null 2>&1; then
    echo "ERROR: HermesBridge not responding at $BRIDGE_URL"
    echo "Launch Minecraft with the HermesBridge mod first."
    exit 1
fi

# Install MCP server deps if needed
if [ ! -d "$SCRIPT_DIR/mcp-server/node_modules" ]; then
    echo "Installing MCP server dependencies..."
    (cd "$SCRIPT_DIR/mcp-server" && npm install)
fi

# Build hermes args
HERMES_ARGS=(chat --yolo)

if [ -n "$MODEL" ]; then
    HERMES_ARGS+=(--model "$MODEL")
fi

# Install SOUL
if [ -f "$SOUL" ]; then
    cp "$SOUL" ~/.hermes/SOUL.md
    echo "Installed SOUL: $(basename "$SOUL")"
fi

# Configure MCP server
export HERMESCRAFT_BRIDGE="$BRIDGE_URL"

echo "=== HermesCraft ==="
echo "Bridge: $BRIDGE_URL"
echo "Goal: $GOAL"
echo "Model: ${MODEL:-default}"
echo ""

exec hermes "${HERMES_ARGS[@]}" \
    --mcp "node $SCRIPT_DIR/mcp-server/index.js" \
    "$GOAL. You are playing Minecraft. Use mc_ tools to observe, move, mine, craft, fight, and build. Start by observing your surroundings with mc_observe."
