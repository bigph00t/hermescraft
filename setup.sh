#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft Setup — One command to install everything
#
# Usage:
#   ./setup.sh                    # full setup
#   ./setup.sh --skills-only      # just install hermes skills
#
# This script:
#   1. Checks prerequisites (Node.js ≥18, hermes CLI)
#   2. Installs bot server dependencies (npm install)
#   3. Puts mc CLI on PATH (~/.local/bin/mc)
#   4. Installs Minecraft gameplay skills into hermes
#   5. Shows next steps
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"
BIN_DIR="$SCRIPT_DIR/bin"
HERMES_DIR="$HOME/.hermes"
SKILLS_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skills-only|--skills) SKILLS_ONLY=true; shift ;;
        --help|-h)
            echo "HermesCraft Setup"
            echo ""
            echo "Usage: ./setup.sh [--skills-only]"
            echo ""
            echo "Installs bot dependencies, mc CLI, and hermes skills."
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Banner ──
cat << 'BANNER'

  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║     ⚡ H E R M E S C R A F T  v3 ⚡          ║
  ║                                               ║
  ║     S E T U P                                 ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝

BANNER

ERRORS=0

# ═════════════════════════════════════════════════
# Step 1: Prerequisites
# ═════════════════════════════════════════════════
echo "  [1/4] Checking prerequisites..."

# Node.js
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "  ✓ Node.js $NODE_VER"
    else
        echo "  ✗ Node.js $NODE_VER too old (need ≥18)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  ✗ Node.js not found"
    echo "    Install: https://nodejs.org/ (v18+)"
    ERRORS=$((ERRORS + 1))
fi

# hermes CLI
HERMES=""
for c in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
    if command -v "$c" &>/dev/null || [ -x "$c" ]; then HERMES="$c"; break; fi
done
if [ -n "$HERMES" ]; then
    echo "  ✓ hermes CLI: $HERMES"
else
    echo "  ✗ hermes CLI not found"
    echo "    Install: pip install hermes-agent"
    ERRORS=$((ERRORS + 1))
fi

# curl + python3
command -v curl &>/dev/null && echo "  ✓ curl" || { echo "  ✗ curl required"; ERRORS=$((ERRORS + 1)); }
command -v python3 &>/dev/null && echo "  ✓ python3" || { echo "  ✗ python3 required"; ERRORS=$((ERRORS + 1)); }

if [ $ERRORS -gt 0 ] && [ "$SKILLS_ONLY" = false ]; then
    echo ""
    echo "  ✗ $ERRORS prerequisite(s) missing. Fix and re-run."
    exit 1
fi

# ═════════════════════════════════════════════════
# Step 2: Install bot dependencies
# ═════════════════════════════════════════════════
echo ""
echo "  [2/4] Installing bot server..."

if [ "$SKILLS_ONLY" = false ]; then
    cd "$BOT_DIR"
    if npm install --no-audit --no-fund 2>&1 | tail -3; then
        echo "  ✓ Bot dependencies installed"
    else
        echo "  ✗ npm install failed"
        exit 1
    fi
    cd "$SCRIPT_DIR"
else
    echo "  Skipped (--skills-only)"
fi

# ═════════════════════════════════════════════════
# Step 3: Install mc CLI
# ═════════════════════════════════════════════════
echo ""
echo "  [3/4] Installing mc CLI..."

MC_LINK="$HOME/.local/bin/mc"
mkdir -p "$HOME/.local/bin"

if [ -L "$MC_LINK" ] || [ ! -e "$MC_LINK" ]; then
    ln -sf "$BIN_DIR/mc" "$MC_LINK"
    echo "  ✓ mc CLI → ~/.local/bin/mc"
else
    echo "  ⚠ ~/.local/bin/mc exists (not a symlink). Skipping."
    echo "    Add $BIN_DIR to your PATH instead."
fi

# Verify PATH
if command -v mc &>/dev/null; then
    echo "  ✓ mc is on PATH"
else
    echo "  ⚠ ~/.local/bin not in PATH. Add to ~/.bashrc:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

# ═════════════════════════════════════════════════
# Step 4: Install hermes skills
# ═════════════════════════════════════════════════
echo ""
echo "  [4/4] Installing Minecraft skills..."

SKILL_COUNT=0
for skill_file in "$SCRIPT_DIR/skills/"*.md; do
    if [ -f "$skill_file" ]; then
        skill_name=$(basename "$skill_file" .md)
        skill_dir="$HERMES_DIR/skills/gaming/$skill_name"
        mkdir -p "$skill_dir"
        cp "$skill_file" "$skill_dir/SKILL.md"
        SKILL_COUNT=$((SKILL_COUNT + 1))
        echo "  ✓ $skill_name"
    fi
done
echo "  Installed $SKILL_COUNT skills"

# ═════════════════════════════════════════════════
# Done
# ═════════════════════════════════════════════════
echo ""
echo "  ═══════════════════════════════════════════"
echo "  ✓ SETUP COMPLETE"
echo "  ═══════════════════════════════════════════"
echo ""
echo "  Quick start:"
echo ""
echo "  1. Start your Minecraft world (singleplayer + Open to LAN, or a server)"
echo "     - For LAN: note the port shown in chat (e.g. 35901)"
echo "     - For dedicated server: set online-mode=false in server.properties"
echo ""
echo "  2. Launch HermesCraft:"
echo "     MC_PORT=35901 ./hermescraft.sh"
echo "     MC_PORT=35901 ./hermescraft.sh \"Build a house\""
echo ""
echo "  3. Talk to the bot in Minecraft chat (press T)"
echo ""
echo "  Manual control:"
echo "     mc status        # see game state"
echo "     mc chat \"hello\"  # send chat"
echo "     mc collect oak_log 5"
echo ""
