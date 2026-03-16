#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft Setup — One command to install everything
#
# Usage:
#   ./setup.sh               # full setup
#   ./setup.sh --check       # just verify prerequisites
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"
BIN_DIR="$SCRIPT_DIR/bin"
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) CHECK_ONLY=true; shift ;;
        --help|-h)
            echo "HermesCraft Setup"
            echo ""
            echo "Usage: ./setup.sh [--check]"
            echo ""
            echo "Installs bot dependencies and puts mc CLI on PATH."
            echo "  --check   Just verify prerequisites, don't install"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

cat << 'BANNER'

  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║     ⚡ H E R M E S C R A F T ⚡              ║
  ║     AI Agents Living in Minecraft             ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝

BANNER

ERRORS=0

# ── Step 1: Prerequisites ──
echo "  [1/3] Checking prerequisites..."

# Node.js
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "    ✓ Node.js $NODE_VER"
    else
        echo "    ✗ Node.js $NODE_VER too old (need ≥18)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "    ✗ Node.js not found — install from https://nodejs.org/ (v18+)"
    ERRORS=$((ERRORS + 1))
fi

# hermes CLI
HERMES=""
for c in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
    if command -v "$c" &>/dev/null || [ -x "$c" ]; then HERMES="$c"; break; fi
done
if [ -n "$HERMES" ]; then
    echo "    ✓ hermes CLI: $HERMES"
else
    echo "    ✗ hermes CLI not found — pip install hermes-agent"
    ERRORS=$((ERRORS + 1))
fi

# curl + python3 + java
command -v curl &>/dev/null && echo "    ✓ curl" || { echo "    ✗ curl required"; ERRORS=$((ERRORS + 1)); }
command -v python3 &>/dev/null && echo "    ✓ python3" || { echo "    ✗ python3 required"; ERRORS=$((ERRORS + 1)); }
if command -v java &>/dev/null; then
    echo "    ✓ java $(java -version 2>&1 | head -1)"
else
    echo "    ✗ java required for Paper server"
    ERRORS=$((ERRORS + 1))
fi
if python3 -c "import nbtlib" 2>/dev/null; then
    echo "    ✓ python nbtlib"
else
    echo "    ⚠ python package nbtlib missing (needed for server/start.sh --reset)"
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "  ✗ $ERRORS prerequisite(s) missing. Fix and re-run."
    exit 1
fi

[ "$CHECK_ONLY" = true ] && { echo ""; echo "  ✓ All prerequisites met!"; exit 0; }

# ── Step 2: Install bot dependencies ──
echo ""
echo "  [2/3] Installing bot server dependencies..."

cd "$BOT_DIR"
if npm install --no-audit --no-fund 2>&1 | tail -3; then
    echo "    ✓ Bot dependencies installed"
else
    echo "    ✗ npm install failed"
    exit 1
fi
cd "$SCRIPT_DIR"

# ── Step 3: Install mc CLI ──
echo ""
echo "  [3/3] Installing mc CLI..."

MC_LINK="$HOME/.local/bin/mc"
mkdir -p "$HOME/.local/bin"

if [ -L "$MC_LINK" ] || [ ! -e "$MC_LINK" ]; then
    ln -sf "$BIN_DIR/mc" "$MC_LINK"
    echo "    ✓ mc CLI → ~/.local/bin/mc"
else
    echo "    ⚠ ~/.local/bin/mc exists (not a symlink). Skipping."
    echo "      Add $BIN_DIR to your PATH instead."
fi

if command -v mc &>/dev/null; then
    echo "    ✓ mc is on PATH"
else
    echo "    ⚠ ~/.local/bin not in PATH. Add to ~/.bashrc:"
    echo "      export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

# Ensure primary scripts are executable
chmod +x "$SCRIPT_DIR/hermescraft.sh" "$SCRIPT_DIR/civilization.sh" "$SCRIPT_DIR/landfolk.sh" "$BIN_DIR/mc" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/scripts/run-landfolk-agent.sh" "$SCRIPT_DIR/scripts/run-landfolk-bots.sh" 2>/dev/null || true

# Create data directory
mkdir -p "$SCRIPT_DIR/data"

echo ""
echo "  ═══════════════════════════════════════════"
echo "  ✓ SETUP COMPLETE"
echo "  ═══════════════════════════════════════════"
echo ""
echo "  SINGLE AGENT (play with Hermes):"
echo "    MC_PORT=12345 ./hermescraft.sh"
echo ""
echo "  CIVILIZATION (7 autonomous agents):"
echo "    ./civilization.sh --port 12345"
echo ""
echo "  Start Minecraft first (server or singleplayer + Open to LAN)."
echo "  Set online-mode=false in server.properties for offline servers."
echo ""
