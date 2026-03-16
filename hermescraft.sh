#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# hermescraft — Start Hermes playing Minecraft
#
# Usage:
#   ./hermescraft.sh                       # play together
#   ./hermescraft.sh "build me a castle"   # play with a goal
#   ./hermescraft.sh --bot-only            # just start the bot server
#
# Environment:
#   MC_HOST      Minecraft server host (default: localhost)
#   MC_PORT      Minecraft server port (default: 25565)
#   MC_USERNAME  Bot name (default: HermesBot)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# Claude Code sets ANTHROPIC_API_KEY="" (empty) in subprocesses, which shadows
# hermes's own .env. Always load the key directly from ~/.hermes/.env.
_HERMES_KEY=$(grep "^ANTHROPIC_API_KEY=" "$HOME/.hermes/.env" 2>/dev/null | head -1 | cut -d= -f2-)
[ -n "$_HERMES_KEY" ] && export ANTHROPIC_API_KEY="$_HERMES_KEY"
unset _HERMES_KEY

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"
BIN_DIR="$SCRIPT_DIR/bin"

MC_HOST="${MC_HOST:-localhost}"
MC_PORT="${MC_PORT:-25565}"
MC_USERNAME="${MC_USERNAME:-HermesBot}"
API_PORT="${API_PORT:-3001}"
# API_URL is set after arg parsing (see below)

BOT_ONLY=false
GOAL=""
SOUL_BACKUP=""
SOUL_OVERRIDE=""
BOT_PID=""

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --bot-only) BOT_ONLY=true; shift ;;
        --name) MC_USERNAME="$2"; shift 2 ;;
        --port) API_PORT="$2"; shift 2 ;;
        --soul) SOUL_OVERRIDE="$2"; shift 2 ;;
        --help|-h)
            echo "hermescraft — Hermes plays Minecraft with you"
            echo ""
            echo "Usage: ./hermescraft.sh [options] [goal]"
            echo "       ./hermescraft.sh --bot-only"
            echo ""
            echo "Options:"
            echo "  --name NAME   Set bot username (default: HermesBot)"
            echo "  --port PORT   Set API port (default: 3001)"
            echo "  --soul FILE   Use custom SOUL file instead of SOUL-minecraft.md"
            echo "  --bot-only    Start bot server only (no Hermes agent)"
            echo "  --help, -h    Show this help"
            echo ""
            echo "Environment:"
            echo "  MC_HOST       Minecraft server host (default: localhost)"
            echo "  MC_PORT       Minecraft server port (default: 25565)"
            echo "  MC_USERNAME   Bot name (default: HermesBot)"
            echo "  API_PORT      Bot API port (default: 3001)"
            exit 0 ;;
        *) GOAL="$1"; shift ;;
    esac
done

# Set API_URL after arg parsing so --port takes effect
API_URL="http://localhost:$API_PORT"

# Cleanup on exit
cleanup() {
    [ -n "$BOT_PID" ] && kill "$BOT_PID" 2>/dev/null && echo "  Bot server stopped."
    [ -n "$SOUL_BACKUP" ] && [ -f "$SOUL_BACKUP" ] && mv "$SOUL_BACKUP" "$HOME/.hermes/SOUL.md"
    echo "  Hermes has left the game."
}
trap cleanup EXIT INT TERM

echo ""
echo "  ⚡ HermesCraft v3"
echo ""

# Check prerequisites
command -v node &>/dev/null || { echo "  ✗ Need Node.js (v18+)"; exit 1; }
[ -d "$BOT_DIR/node_modules" ] || { echo "  Installing bot dependencies..."; cd "$BOT_DIR" && npm install --no-audit --no-fund 2>&1 | tail -2; cd "$SCRIPT_DIR"; }

# Put mc on PATH
export PATH="$BIN_DIR:$PATH"
export MC_API_URL="$API_URL"
export MC_USERNAME

# Symlink mc to ~/.local/bin if not there
[ -L "$HOME/.local/bin/mc" ] || { mkdir -p "$HOME/.local/bin"; ln -sf "$BIN_DIR/mc" "$HOME/.local/bin/mc" 2>/dev/null || true; }

# Start bot server if not already running
if curl -sf "$API_URL/health" &>/dev/null; then
    echo "  ✓ Bot server already running"
else
    echo "  Starting bot server ($MC_USERNAME → $MC_HOST:$MC_PORT)..."
    cd "$BOT_DIR"
    MC_HOST="$MC_HOST" MC_PORT="$MC_PORT" MC_USERNAME="$MC_USERNAME" API_PORT="$API_PORT" \
        node server.js > /tmp/hermescraft-bot.log 2>&1 &
    BOT_PID=$!
    cd "$SCRIPT_DIR"

    # Wait for it
    for i in $(seq 1 20); do
        curl -sf "$API_URL/health" &>/dev/null && break
        kill -0 "$BOT_PID" 2>/dev/null || { echo "  ✗ Bot crashed. Check /tmp/hermescraft-bot.log"; exit 1; }
        sleep 1
    done
    echo "  ✓ Bot server ready (PID $BOT_PID)"
fi

# Wait for MC connection
echo "  Connecting to Minecraft..."
for i in $(seq 1 15); do
    CONNECTED=$(curl -sf "$API_URL/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('connected',False))" 2>/dev/null || echo "False")
    [ "$CONNECTED" = "True" ] && break
    sleep 2
done

if [ "$CONNECTED" = "True" ]; then
    echo "  ✓ $MC_USERNAME is in the game!"
else
    echo "  ⚠ Bot couldn't connect to Minecraft at $MC_HOST:$MC_PORT"
    echo "    Make sure Minecraft is running and the port is correct."
    echo "    Bot server is still running — it'll auto-reconnect when MC is ready."
fi

if [ "$BOT_ONLY" = true ]; then
    echo ""
    echo "  Bot server running. Try: mc status / mc chat 'hello'"
    echo "  Press Ctrl+C to stop."
    wait "$BOT_PID" 2>/dev/null
    exit 0
fi

# Find hermes
HERMES=""
for c in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
    if command -v "$c" &>/dev/null || [ -x "$c" ]; then HERMES="$c"; break; fi
done
[ -z "$HERMES" ] && { echo "  ✗ hermes CLI not found. pip install hermes-agent"; exit 1; }

# Swap SOUL.md temporarily
SOUL_FILE="$HOME/.hermes/SOUL.md"
if [ -f "$SOUL_FILE" ]; then
    SOUL_BACKUP="$SOUL_FILE.hermescraft-bak"
    cp "$SOUL_FILE" "$SOUL_BACKUP"
fi
if [ -n "$SOUL_OVERRIDE" ] && [ -f "$SOUL_OVERRIDE" ]; then
    cp "$SOUL_OVERRIDE" "$SOUL_FILE"
else
    cp "$SCRIPT_DIR/SOUL-minecraft.md" "$SOUL_FILE"
fi

echo ""
echo "  ═══════════════════════════════════════"
[ -n "$GOAL" ] && echo "  Goal: $GOAL"
echo "  Talk to Hermes in Minecraft chat!"
echo "  Say: hermes follow me / hermes build a house"
echo "  ═══════════════════════════════════════"
echo ""

# Build the prompt
if [ -n "$GOAL" ]; then
    PROMPT="You're in Minecraft. Your goal: $GOAL

You have the \`mc\` CLI to control your bot. Run \`mc status\` to see where you are, what's around, and if the player said anything. Chat with the player via \`mc chat \"message\"\`. Check \`mc commands\` for requests they made in-game.

Start by running \`mc status\` to see the world."
else
    PROMPT="You're in Minecraft with a friend. You have the \`mc\` CLI to control your bot.

Run \`mc status\` to see where you are, check your health/inventory, and see if the player said anything. Chat with them via \`mc chat \"message\"\`. Check \`mc commands\` for requests they made in-game.

Play naturally — mine, craft, explore, build, fight mobs, chat with the player. Be yourself.

Start by running \`mc status\`."
fi

$HERMES chat --yolo -q "$PROMPT"
EXIT_CODE=$?
cleanup
trap - EXIT INT TERM
exit $EXIT_CODE
