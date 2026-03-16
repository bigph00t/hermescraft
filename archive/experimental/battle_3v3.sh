#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft — 3v3 Battle: Team Claude vs Team Codex
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

HERMES="${HERMES:-$(which hermes)}"
SOUL_FILE="$HOME/.hermes/SOUL.md"
SOUL_BACKUP=""
PIDS=()

cleanup() {
    echo ""
    echo "  ⚔ Battle over! Stopping all agents..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    [ -n "$SOUL_BACKUP" ] && [ -f "$SOUL_BACKUP" ] && mv "$SOUL_BACKUP" "$SOUL_FILE"
    echo "  All agents stopped."
}
trap cleanup EXIT INT TERM

# Backup SOUL
if [ -f "$SOUL_FILE" ]; then
    SOUL_BACKUP="$SOUL_FILE.battle-bak"
    cp "$SOUL_FILE" "$SOUL_BACKUP"
fi

echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║     ⚔  HERMESCRAFT 3v3 BATTLE ROYALE  ⚔         ║"
echo "  ║                                                   ║"
echo "  ║  TEAM CLAUDE (claude-sonnet-4)                    ║"
echo "  ║    ClaudeAlpha · ClaudeBravo · ClaudeCharlie      ║"
echo "  ║                                                   ║"
echo "  ║  TEAM CODEX (o4-mini)                             ║"
echo "  ║    CodexForge · CodexGhost · CodexHavoc           ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo ""

build_prompt() {
    local NAME="$1"
    local PORT="$2"
    local TEAM="$3"
    
    cat <<EOF
You are $NAME in a 3v3 Minecraft deathmatch. Your team is $TEAM.

You have the \`mc\` CLI. IMPORTANT: Set MC_API_URL first every command:
  export MC_API_URL=http://localhost:$PORT

Then use: mc status, mc chat "msg", mc collect, mc craft, mc attack, mc fight, mc find_entities, mc sprint_attack, mc combo, mc eat, mc equip, mc pickup, mc follow, mc goto, mc flee

START NOW:
1. Run: export MC_API_URL=http://localhost:$PORT
2. Run: mc status
3. Run: mc chat "$NAME reporting for duty! Team $TEAM let's destroy these fools!"
4. Punch trees, craft wooden sword, then hunt enemies
5. CHAT CONSTANTLY — trash talk, coordinate, react. Every 2-3 actions say something in chat.
6. Find and kill all enemy team members.

REMEMBER: mc chat before and after every fight. Call out positions. Talk trash. Have fun. This is a show.
EOF
}

# Launch Team Claude agents (claude-sonnet-4 via anthropic)
CLAUDE_NAMES=("ClaudeAlpha" "ClaudeBravo" "ClaudeCharlie")
CLAUDE_PORTS=(3001 3002 3003)

for i in 0 1 2; do
    NAME="${CLAUDE_NAMES[$i]}"
    PORT="${CLAUDE_PORTS[$i]}"
    
    echo "  ⚔ Launching $NAME (claude-sonnet-4)..."
    
    PROMPT=$(build_prompt "$NAME" "$PORT" "CLAUDE")
    
    cp "$SCRIPT_DIR/SOUL-battle-claude.md" "$SOUL_FILE"
    
    MC_API_URL="http://localhost:$PORT" \
    $HERMES chat --yolo -m "claude-sonnet-4" --provider anthropic \
        -q "$PROMPT" > "/tmp/battle-${NAME}.log" 2>&1 &
    PIDS+=($!)
    echo "    PID: ${PIDS[-1]}"
    sleep 2
done

# Launch Team Codex agents (o4-mini via openai-codex)
CODEX_NAMES=("CodexForge" "CodexGhost" "CodexHavoc")
CODEX_PORTS=(3006 3007 3008)

for i in 0 1 2; do
    NAME="${CODEX_NAMES[$i]}"
    PORT="${CODEX_PORTS[$i]}"
    
    echo "  ⚔ Launching $NAME (o4-mini)..."
    
    PROMPT=$(build_prompt "$NAME" "$PORT" "CODEX")
    
    cp "$SCRIPT_DIR/SOUL-battle-codex.md" "$SOUL_FILE"
    
    MC_API_URL="http://localhost:$PORT" \
    $HERMES chat --yolo -m "o4-mini" --provider openai-codex \
        -q "$PROMPT" > "/tmp/battle-${NAME}.log" 2>&1 &
    PIDS+=($!)
    echo "    PID: ${PIDS[-1]}"
    sleep 2
done

echo ""
echo "  ═══════════════════════════════════════════════════"
echo "  All 6 agents launched! Watch the battle in-game."
echo "  Logs: /tmp/battle-*.log"
echo "  Press Ctrl+C to stop all."
echo "  ═══════════════════════════════════════════════════"
echo ""

# Tail all logs interleaved
tail -f /tmp/battle-Claude*.log /tmp/battle-Codex*.log 2>/dev/null
