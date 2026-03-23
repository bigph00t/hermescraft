#!/usr/bin/env bash
# launch-duo.sh — Launch two Mineflayer agents (Luna + Max) in tmux
# Usage: ./launch-duo.sh [server_host] [server_port]
#
# v2.0 architecture: Mineflayer bots connect directly — no Java client needed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_HOST="${1:-localhost}"
MC_PORT="${2:-25565}"

# ── Load env (try Glass path first, then local) ──
if [ -f /opt/hermescraft/agent/.env ]; then
    set -a
    source /opt/hermescraft/agent/.env
    set +a
    echo "[launch-duo] Loaded env from /opt/hermescraft/agent/.env (Glass)"
fi
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    echo "[launch-duo] Loaded env from $SCRIPT_DIR/.env (local override)"
fi

VLLM_URL="${VLLM_URL:-http://localhost:8000/v1}"
VLLM_API_KEY="${VLLM_API_KEY:-not-needed}"
MODEL_NAME="${MODEL_NAME:-hermes}"
TICK_MS="${TICK_MS:-3000}"
TEMPERATURE="${TEMPERATURE:-0.6}"
MAX_TOKENS="${MAX_TOKENS:-128}"

if [ "$VLLM_URL" = "http://localhost:8000/v1" ]; then
    echo "[launch-duo] Using localhost LLM — ensure model servers are running"
fi

# ── Install deps if needed ──
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[launch-duo] Installing dependencies..."
    (cd "$SCRIPT_DIR" && npm install)
fi

echo "============================================"
echo "  HermesCraft Duo — Luna & Max"
echo "============================================"
echo "  Server:    $MC_HOST:$MC_PORT"
echo "  Model:     $MODEL_NAME"
echo "  LLM URL:   $VLLM_URL"
echo "  Tick:      ${TICK_MS}ms"
echo "  Mode:      open_ended"
echo "============================================"
echo ""

SESSION="hermescraft-duo"

# Kill existing session
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1

tmux new-session -d -s "$SESSION" -n "luna"

# ── Luna — the artist ──
LUNA_CMD="$(cat <<'HEREDOC'
echo '=== Luna — The Artist ==='
echo 'Starting in 3s...'
sleep 3
while true; do
    AGENT_NAME='luna' \
    MC_USERNAME='luna' \
    MC_HOST='MC_HOST_PLACEHOLDER' \
    MC_PORT='MC_PORT_PLACEHOLDER' \
    VLLM_URL='VLLM_URL_PLACEHOLDER' \
    VLLM_API_KEY='VLLM_API_KEY_PLACEHOLDER' \
    MODEL_NAME='MODEL_NAME_PLACEHOLDER' \
    AGENT_MODE='open_ended' \
    TICK_MS='TICK_MS_PLACEHOLDER' \
    TEMPERATURE='TEMPERATURE_PLACEHOLDER' \
    MAX_TOKENS='MAX_TOKENS_PLACEHOLDER' \
        node SCRIPT_DIR_PLACEHOLDER/start.js
    CODE=$?
    [ $CODE -eq 0 ] && break                    # clean shutdown — stop
    [ $CODE -eq 42 ] && { echo "[!] Luna scheduled restart — relaunching..."; continue; }
    echo "[!] Luna crashed (exit $CODE) — restarting in 5s..."
    sleep 5
done
HEREDOC
)"

# Replace placeholders
LUNA_CMD="${LUNA_CMD//MC_HOST_PLACEHOLDER/$MC_HOST}"
LUNA_CMD="${LUNA_CMD//MC_PORT_PLACEHOLDER/$MC_PORT}"
LUNA_CMD="${LUNA_CMD//VLLM_URL_PLACEHOLDER/$VLLM_URL}"
LUNA_CMD="${LUNA_CMD//VLLM_API_KEY_PLACEHOLDER/$VLLM_API_KEY}"
LUNA_CMD="${LUNA_CMD//MODEL_NAME_PLACEHOLDER/$MODEL_NAME}"
LUNA_CMD="${LUNA_CMD//TICK_MS_PLACEHOLDER/$TICK_MS}"
LUNA_CMD="${LUNA_CMD//TEMPERATURE_PLACEHOLDER/$TEMPERATURE}"
LUNA_CMD="${LUNA_CMD//MAX_TOKENS_PLACEHOLDER/$MAX_TOKENS}"
LUNA_CMD="${LUNA_CMD//SCRIPT_DIR_PLACEHOLDER/$SCRIPT_DIR}"

tmux send-keys -t "$SESSION:luna" "$LUNA_CMD" Enter

# ── Max — the engineer (stagger 15s) ──
tmux new-window -t "$SESSION" -n "max"

MAX_CMD="$(cat <<'HEREDOC'
echo '=== Max — The Engineer ==='
echo 'Starting in 3s...'
sleep 3
while true; do
    AGENT_NAME='max' \
    MC_USERNAME='max' \
    MC_HOST='MC_HOST_PLACEHOLDER' \
    MC_PORT='MC_PORT_PLACEHOLDER' \
    VLLM_URL='VLLM_URL_PLACEHOLDER' \
    VLLM_API_KEY='VLLM_API_KEY_PLACEHOLDER' \
    MODEL_NAME='MODEL_NAME_PLACEHOLDER' \
    AGENT_MODE='open_ended' \
    TICK_MS='TICK_MS_PLACEHOLDER' \
    TEMPERATURE='TEMPERATURE_PLACEHOLDER' \
    MAX_TOKENS='MAX_TOKENS_PLACEHOLDER' \
        node SCRIPT_DIR_PLACEHOLDER/start.js
    CODE=$?
    [ $CODE -eq 0 ] && break                    # clean shutdown — stop
    [ $CODE -eq 42 ] && { echo "[!] Max scheduled restart — relaunching..."; continue; }
    echo "[!] Max crashed (exit $CODE) — restarting in 5s..."
    sleep 5
done
HEREDOC
)"

MAX_CMD="${MAX_CMD//MC_HOST_PLACEHOLDER/$MC_HOST}"
MAX_CMD="${MAX_CMD//MC_PORT_PLACEHOLDER/$MC_PORT}"
MAX_CMD="${MAX_CMD//VLLM_URL_PLACEHOLDER/$VLLM_URL}"
MAX_CMD="${MAX_CMD//VLLM_API_KEY_PLACEHOLDER/$VLLM_API_KEY}"
MAX_CMD="${MAX_CMD//MODEL_NAME_PLACEHOLDER/$MODEL_NAME}"
MAX_CMD="${MAX_CMD//TICK_MS_PLACEHOLDER/$TICK_MS}"
MAX_CMD="${MAX_CMD//TEMPERATURE_PLACEHOLDER/$TEMPERATURE}"
MAX_CMD="${MAX_CMD//MAX_TOKENS_PLACEHOLDER/$MAX_TOKENS}"
MAX_CMD="${MAX_CMD//SCRIPT_DIR_PLACEHOLDER/$SCRIPT_DIR}"

tmux send-keys -t "$SESSION:max" "$MAX_CMD" Enter

echo ""
echo "============================================"
echo "  Luna & Max launched!"
echo "============================================"
echo ""
echo "  tmux attach -t $SESSION"
echo ""
echo "  Windows:"
echo "    luna  — Luna agent (artist, creative builder)"
echo "    max   — Max agent (engineer, infrastructure)"
echo ""
echo "  Controls:"
echo "    Ctrl+B, n/p    — next/prev window"
echo "    Ctrl+B, d      — detach"
echo "    tmux kill-session -t $SESSION  — stop both"
echo ""
