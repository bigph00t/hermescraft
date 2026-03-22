#!/usr/bin/env bash
# launch-agents.sh — Spin up N Minecraft agent bots in tmux on Glass
# Usage: ./launch-agents.sh [num_bots]  (default: 10)
#
# Each bot gets:
#   - Its own MC client (Xvfb + Fabric + Baritone + HermesBridge)
#   - Its own Node.js agent process
#   - A unique HermesBridge HTTP port (3001 + N)
#   - A unique Xvfb display (:99 + N)
#
# All managed in a single tmux session "hermescraft-bots".
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NUM_BOTS="${1:-10}"

# Bot names — enough for 10, extend if needed
BOT_NAMES=(Steve Alex Liam Emma Noah Olivia Ethan Sophia Mason Ava)

# ── Load API key from agent .env on Glass ──
AGENT_ENV="/opt/hermescraft/agent/.env"
if [ -f "$AGENT_ENV" ]; then
    set -a
    source "$AGENT_ENV"
    set +a
    echo "[launch-agents] Loaded env from $AGENT_ENV"
else
    echo "WARNING: $AGENT_ENV not found — VLLM_API_KEY may not be set"
fi

# ── LLM config (MiniMax M2.7-highspeed) ──
VLLM_URL="${VLLM_URL:-https://api.minimaxi.chat/v1}"
VLLM_API_KEY="${VLLM_API_KEY:-}"
MODEL_NAME="${MODEL_NAME:-MiniMax-M2.7-highspeed}"
AGENT_MODE="${AGENT_MODE:-open_ended}"
TICK_MS="${TICK_MS:-3000}"
TEMPERATURE="${TEMPERATURE:-0.6}"
MAX_TOKENS="${MAX_TOKENS:-384}"

if [ -z "$VLLM_API_KEY" ]; then
    echo "ERROR: VLLM_API_KEY not set. Put it in $AGENT_ENV or export it."
    exit 1
fi

# ── Validate bot count ──
if [ "$NUM_BOTS" -gt "${#BOT_NAMES[@]}" ]; then
    echo "ERROR: Max ${#BOT_NAMES[@]} bots supported (add more names to BOT_NAMES array)"
    exit 1
fi

if [ "$NUM_BOTS" -lt 1 ]; then
    echo "ERROR: Need at least 1 bot"
    exit 1
fi

echo "============================================"
echo "  HermesCraft Multi-Agent Launcher"
echo "============================================"
echo "  Bots:      $NUM_BOTS"
echo "  Model:     $MODEL_NAME"
echo "  VLLM URL:  $VLLM_URL"
echo "  Tick:      ${TICK_MS}ms"
echo "  Mode:      $AGENT_MODE"
echo "============================================"
echo ""

# ── Install Node dependencies if needed ──
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[launch-agents] Installing Node dependencies..."
    (cd "$SCRIPT_DIR" && npm install --production)
fi

# ── Create tmux session ──
SESSION="hermescraft-bots"

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1

tmux new-session -d -s "$SESSION" -n "server"

# First window: docker server logs
tmux send-keys -t "$SESSION:server" "echo '=== MC Server Logs ===' && docker logs -f minecraft-server 2>&1 || echo 'No minecraft-server container found'" Enter

# ── Launch each bot ──
for i in $(seq 0 $((NUM_BOTS - 1))); do
    NAME="${BOT_NAMES[$i]}"
    BRIDGE_PORT=$((3001 + i))
    DISPLAY_NUM=$((99 + i))
    MOD_URL="http://localhost:$BRIDGE_PORT"

    echo "[launch-agents] Bot $i: $NAME (bridge=$BRIDGE_PORT, display=:$DISPLAY_NUM)"

    # ── Client window ──
    CLIENT_WIN="bot${i}-client"
    tmux new-window -t "$SESSION" -n "$CLIENT_WIN"
    tmux send-keys -t "$SESSION:$CLIENT_WIN" \
        "echo '=== $NAME Client (port=$BRIDGE_PORT, display=:$DISPLAY_NUM) ===' && $SCRIPT_DIR/launch-client.sh '$NAME' '$BRIDGE_PORT' '$DISPLAY_NUM'" Enter

    # ── Wait for client to load ──
    # Agent window is created now but the agent command waits for the bridge
    AGENT_WIN="bot${i}-agent"
    tmux new-window -t "$SESSION" -n "$AGENT_WIN"

    # Build the agent launch command with retry loop
    # Waits up to 120s for the bridge to come up, then starts the agent
    AGENT_CMD="$(cat <<HEREDOC
echo '=== $NAME Agent (bridge=$MOD_URL) ==='
echo 'Waiting for MC client + HermesBridge to start...'
TRIES=0
while [ \$TRIES -lt 40 ]; do
    if curl -sf "$MOD_URL/health" >/dev/null 2>&1; then
        echo "Bridge is up! Starting agent..."
        break
    fi
    TRIES=\$((TRIES + 1))
    echo "  Waiting for bridge... (\$TRIES/40)"
    sleep 3
done
if [ \$TRIES -ge 40 ]; then
    echo "ERROR: Bridge at $MOD_URL never came up after 120s"
    exit 1
fi
# Small delay for world to fully load
sleep 5
# Run agent with auto-restart
while true; do
    AGENT_NAME='$NAME' \\
    MC_USERNAME='$NAME' \\
    MOD_URL='$MOD_URL' \\
    VLLM_URL='$VLLM_URL' \\
    VLLM_API_KEY='$VLLM_API_KEY' \\
    MODEL_NAME='$MODEL_NAME' \\
    AGENT_MODE='$AGENT_MODE' \\
    TICK_MS='$TICK_MS' \\
    TEMPERATURE='$TEMPERATURE' \\
    MAX_TOKENS='$MAX_TOKENS' \\
        node $SCRIPT_DIR/agent/index.js
    CODE=\$?
    [ \$CODE -eq 0 ] && break
    echo "[!] $NAME agent crashed (exit \$CODE) — restarting in 5s..."
    sleep 5
done
HEREDOC
)"

    tmux send-keys -t "$SESSION:$AGENT_WIN" "$AGENT_CMD" Enter

    # Stagger client launches to avoid overwhelming the server
    if [ "$i" -lt $((NUM_BOTS - 1)) ]; then
        echo "  Staggering next launch (30s)..."
        sleep 30
    fi
done

echo ""
echo "============================================"
echo "  All $NUM_BOTS bots launched!"
echo "============================================"
echo ""
echo "  tmux attach -t $SESSION"
echo ""
echo "  Windows:"
echo "    server         — MC server docker logs"
for i in $(seq 0 $((NUM_BOTS - 1))); do
    echo "    bot${i}-client   — ${BOT_NAMES[$i]} MC client"
    echo "    bot${i}-agent    — ${BOT_NAMES[$i]} AI agent"
done
echo ""
echo "  Controls:"
echo "    Ctrl+B, n/p    — next/prev window"
echo "    Ctrl+B, w      — window list"
echo "    Ctrl+B, d      — detach"
echo "    tmux kill-session -t $SESSION  — stop everything"
echo ""
