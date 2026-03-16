#!/usr/bin/env bash
# HermesCraft — Launch Hermes Agent CLI with Minecraft MCP tools
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defaults
BRIDGE_URL="${HERMESCRAFT_BRIDGE:-http://localhost:3001}"
MODEL="${HERMESCRAFT_MODEL:-}"
GOAL="${1:-${HERMESCRAFT_GOAL:-Survive and thrive in this Minecraft world. Explore, gather resources, build shelter, and respond to players.}}"
SOUL="${HERMESCRAFT_SOUL:-$SCRIPT_DIR/SOUL-minecraft.md}"
MAX_TURNS="${HERMESCRAFT_MAX_TURNS:-200000}"
HERMES_CONFIG="$HOME/.hermes/config.yaml"

# Check hermes CLI is installed
if ! command -v hermes &>/dev/null; then
    echo "ERROR: hermes CLI not found. Install: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"
    exit 1
fi

# Check bridge is running
if ! curl -sf "$BRIDGE_URL/state" >/dev/null 2>&1; then
    echo "ERROR: HermesBridge not responding at $BRIDGE_URL"
    echo "Launch Minecraft with the HermesBridge mod and load into a world first."
    exit 1
fi

# Install MCP server deps if needed
if [ ! -d "$SCRIPT_DIR/mcp-server/node_modules" ]; then
    echo "Installing MCP server dependencies..."
    (cd "$SCRIPT_DIR/mcp-server" && npm install --production)
fi

# Configure Hermes: add hermescraft MCP server to config.yaml
if ! grep -q "hermescraft" "$HERMES_CONFIG" 2>/dev/null; then
    echo "Adding HermesCraft MCP server to Hermes config..."
    python3 -c "
import yaml, sys
with open('$HERMES_CONFIG', 'r') as f:
    config = yaml.safe_load(f)
config.setdefault('mcp_servers', {})['hermescraft'] = {
    'command': 'node',
    'args': ['$SCRIPT_DIR/mcp-server/index.js'],
    'env': {'HERMESCRAFT_BRIDGE_URL': '$BRIDGE_URL'},
    'timeout': 30
}
with open('$HERMES_CONFIG', 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)
print('  Added hermescraft MCP server')
"
else
    # Update bridge URL in case it changed
    python3 -c "
import yaml
with open('$HERMES_CONFIG', 'r') as f:
    config = yaml.safe_load(f)
config['mcp_servers']['hermescraft']['env'] = {'HERMESCRAFT_BRIDGE_URL': '$BRIDGE_URL'}
config['mcp_servers']['hermescraft']['args'] = ['$SCRIPT_DIR/mcp-server/index.js']
with open('$HERMES_CONFIG', 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)
"
fi

# Set max_turns for long-running gameplay
python3 -c "
import yaml
with open('$HERMES_CONFIG', 'r') as f:
    config = yaml.safe_load(f)
config['agent']['max_turns'] = $MAX_TURNS
with open('$HERMES_CONFIG', 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)
"

# Install SOUL personality
if [ -f "$SOUL" ]; then
    cp "$SOUL" ~/.hermes/SOUL.md
    echo "Installed SOUL: $(basename "$SOUL")"
fi

# Build hermes args
HERMES_ARGS=(chat --yolo --provider nous)

if [ -n "$MODEL" ]; then
    HERMES_ARGS+=(--model "$MODEL")
fi

echo ""
echo "=== HermesCraft (Hermes Agent CLI) ==="
echo "Bridge: $BRIDGE_URL"
echo "Goal: $GOAL"
echo "Model: ${MODEL:-Hermes-4-405B (nous)}"
echo "Max turns: $MAX_TURNS"
echo "SOUL: $(basename "$SOUL")"
echo ""

exec hermes "${HERMES_ARGS[@]}" -q "$GOAL"
