#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft — Main Entry Point
#
# Sets up everything needed and launches the Minecraft agent.
#
# Usage:
#   ./hermescraft.sh                        # default: defeat the dragon
#   ./hermescraft.sh "Build a treehouse"    # custom goal
#   ./hermescraft.sh --gameloop             # use Python game loop driver
#   ./hermescraft.sh --setup-only           # just install config, don't play
#
# Environment variables:
#   HERMESCRAFT_MODEL    — model to use (e.g. anthropic/claude-sonnet-4)
#   HERMESCRAFT_BRIDGE   — bridge URL (default: http://localhost:3001)
#   HERMESCRAFT_GOAL     — goal override
#   HERMESCRAFT_INTERVAL — game loop poll interval in seconds (default: 5)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HERMES_DIR="$HOME/.hermes"
HERMES_CONFIG="$HERMES_DIR/config.yaml"
SOUL_FILE="$HERMES_DIR/SOUL.md"
SOUL_BACKUP="$HERMES_DIR/SOUL.md.hermescraft-backup"

GOAL="${HERMESCRAFT_GOAL:-Defeat the Ender Dragon}"
BRIDGE="${HERMESCRAFT_BRIDGE:-http://localhost:3001}"
USE_GAMELOOP=false
SETUP_ONLY=false

# ── Parse args ──
while [[ $# -gt 0 ]]; do
    case "$1" in
        --gameloop)
            USE_GAMELOOP=true
            shift
            ;;
        --setup-only)
            SETUP_ONLY=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./hermescraft.sh [OPTIONS] [GOAL]"
            echo ""
            echo "Options:"
            echo "  --gameloop     Use Python game loop (polls state externally)"
            echo "  --setup-only   Install MCP config and SOUL.md, don't launch"
            echo "  -h, --help     Show this help"
            echo ""
            echo "Environment:"
            echo "  HERMESCRAFT_MODEL    Model to use"
            echo "  HERMESCRAFT_BRIDGE   Bridge URL (default: http://localhost:3001)"
            echo "  HERMESCRAFT_GOAL     Goal for the agent"
            echo ""
            echo "Examples:"
            echo "  ./hermescraft.sh"
            echo "  ./hermescraft.sh 'Build a castle'"
            echo "  HERMESCRAFT_MODEL=anthropic/claude-sonnet-4 ./hermescraft.sh"
            exit 0
            ;;
        *)
            GOAL="$1"
            shift
            ;;
    esac
done

# ── Banner ──
echo ""
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║                                                       ║"
echo "  ║   ██╗  ██╗███████╗██████╗ ███╗   ███╗███████╗███████╗║"
echo "  ║   ██║  ██║██╔════╝██╔══██╗████╗ ████║██╔════╝██╔════╝║"
echo "  ║   ███████║█████╗  ██████╔╝██╔████╔██║█████╗  ███████╗║"
echo "  ║   ██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══╝  ╚════██║║"
echo "  ║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗███████║║"
echo "  ║   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝║"
echo "  ║                     C R A F T                         ║"
echo "  ║                                                       ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Check hermes CLI ──
echo "  [1/5] Checking hermes CLI..."
HERMES=""
for candidate in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
    if command -v "$candidate" &>/dev/null || [ -x "$candidate" ]; then
        HERMES="$candidate"
        break
    fi
done

if [ -z "$HERMES" ]; then
    echo "  ✗ hermes CLI not found"
    echo "    Install with: pip install hermes-agent"
    exit 1
fi
echo "  ✓ hermes found at: $HERMES"

# ── Step 2: Check/install MCP server dependencies ──
echo "  [2/5] Checking MCP server..."
MCP_SERVER="$SCRIPT_DIR/mcp-server/index.js"
if [ -f "$MCP_SERVER" ]; then
    echo "  ✓ MCP server found: $MCP_SERVER"
else
    echo "  ✗ MCP server not found at $MCP_SERVER"
    exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "  ✗ Node.js not found. Install Node.js 18+."
    exit 1
fi

# Install npm dependencies if needed
if [ ! -d "$SCRIPT_DIR/mcp-server/node_modules" ]; then
    echo "  ⚠ Installing MCP server dependencies..."
    (cd "$SCRIPT_DIR/mcp-server" && npm install --silent) || {
        echo "  ✗ npm install failed"
        exit 1
    }
fi
echo "  ✓ MCP server dependencies installed"

# ── Step 3: Check MCP config in hermes ──
echo "  [3/5] Checking hermes MCP configuration..."
mkdir -p "$HERMES_DIR"

MCP_CONFIGURED=false
if [ -f "$HERMES_CONFIG" ]; then
    if grep -q "minecraft" "$HERMES_CONFIG" 2>/dev/null; then
        MCP_CONFIGURED=true
    fi
fi

if [ "$MCP_CONFIGURED" = true ]; then
    echo "  ✓ Minecraft MCP server configured in hermes"
else
    echo "  ⚠ Minecraft MCP server NOT configured in hermes config"
    echo ""
    echo "  Add this to $HERMES_CONFIG under mcp_servers:"
    echo ""
    echo "  mcp_servers:"
    echo "    minecraft:"
    echo "      command: node"
    echo "      args:"
    echo "        - $MCP_SERVER"
    echo "      env:"
    echo "        HERMESCRAFT_BRIDGE_URL: $BRIDGE"
    echo "      timeout: 30"
    echo "      connect_timeout: 45"
    echo ""
    echo "  Or run: hermes config edit"
    echo ""

    # Offer to auto-configure
    if [ -t 0 ]; then
        read -p "  Auto-add MCP config to hermes? [Y/n] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            if [ -f "$HERMES_CONFIG" ]; then
                # Append MCP config if not present
                if ! grep -q "mcp_servers:" "$HERMES_CONFIG" 2>/dev/null; then
                    cat >> "$HERMES_CONFIG" << EOF
mcp_servers:
  minecraft:
    command: node
    args:
    - $MCP_SERVER
    env:
      HERMESCRAFT_BRIDGE_URL: $BRIDGE
    timeout: 30
    connect_timeout: 45
EOF
                else
                    # mcp_servers exists but no minecraft entry
                    # Insert after mcp_servers line
                    sed -i "/^mcp_servers:/a\\
  minecraft:\\
    command: node\\
    args:\\
    - $MCP_SERVER\\
    env:\\
      HERMESCRAFT_BRIDGE_URL: $BRIDGE\\
    timeout: 30\\
    connect_timeout: 45" "$HERMES_CONFIG"
                fi
            else
                # Create minimal config
                cat > "$HERMES_CONFIG" << EOF
agent:
  max_turns: 100000
  verbose: false
  reasoning_effort: high
mcp_servers:
  minecraft:
    command: node
    args:
    - $MCP_SERVER
    env:
      HERMESCRAFT_BRIDGE_URL: $BRIDGE
    timeout: 30
    connect_timeout: 45
memory:
  memory_enabled: true
  nudge_interval: 20
compression:
  enabled: true
  threshold: 0.80
EOF
            fi
            echo "  ✓ MCP config added to $HERMES_CONFIG"
            MCP_CONFIGURED=true
        fi
    fi

    if [ "$MCP_CONFIGURED" = false ]; then
        echo "  Cannot proceed without MCP configuration."
        exit 1
    fi
fi

# ── Step 4: Install SOUL.md ──
echo "  [4/5] Installing Hermes Minecraft persona..."

# Backup existing SOUL.md
if [ -f "$SOUL_FILE" ] && [ ! -f "$SOUL_BACKUP" ]; then
    cp "$SOUL_FILE" "$SOUL_BACKUP"
    echo "  ✓ Backed up existing SOUL.md to $SOUL_BACKUP"
fi

cp "$SCRIPT_DIR/SOUL-minecraft.md" "$SOUL_FILE"
echo "  ✓ Minecraft SOUL.md installed"

# ── Step 5: Check bridge ──
echo "  [5/5] Checking HermesBridge..."
if curl -sf --max-time 3 "$BRIDGE/health" 2>/dev/null | grep -qi 'ok' 2>/dev/null; then
    echo "  ✓ HermesBridge responding at $BRIDGE"
else
    echo "  ⚠ HermesBridge not responding at $BRIDGE"
    echo "    Make sure Minecraft is running with HermesBridge mod."
    echo "    The agent will still launch — it can retry when Minecraft connects."
fi

echo ""

# ── Cleanup handler ──
cleanup() {
    echo ""
    echo "  ─────────────────────────────────────"
    echo "  Restoring original SOUL.md..."
    if [ -f "$SOUL_BACKUP" ]; then
        mv "$SOUL_BACKUP" "$SOUL_FILE"
        echo "  ✓ Original SOUL.md restored"
    fi
    echo "  Hermes has left the game."
    echo ""
}
trap cleanup EXIT INT TERM

# ── Setup-only mode ──
if [ "$SETUP_ONLY" = true ]; then
    echo "  Setup complete. Run ./gameloop.sh or ./hermescraft.sh to play."
    # Don't restore SOUL.md in setup-only mode
    trap - EXIT INT TERM
    exit 0
fi

# ── Launch ──
echo "  ═══════════════════════════════════════"
echo "  Goal:   $GOAL"
echo "  Mode:   $([ "$USE_GAMELOOP" = true ] && echo "Python game loop" || echo "Autonomous agent")"
echo "  ═══════════════════════════════════════"
echo ""

export HERMESCRAFT_GOAL="$GOAL"
export HERMESCRAFT_BRIDGE="$BRIDGE"

if [ "$USE_GAMELOOP" = true ]; then
    # Python game loop: polls state externally and feeds to hermes
    exec python3 "$SCRIPT_DIR/gameloop.py" \
        --bridge "$BRIDGE" \
        --goal "$GOAL" \
        ${HERMESCRAFT_MODEL:+--model "$HERMESCRAFT_MODEL"} \
        ${HERMESCRAFT_INTERVAL:+--interval "$HERMESCRAFT_INTERVAL"}
else
    # Direct mode: hermes loops internally via MCP tool calls
    exec "$SCRIPT_DIR/gameloop.sh" "$GOAL"
fi
