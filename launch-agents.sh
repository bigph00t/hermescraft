#!/usr/bin/env bash
# launch-agents.sh — Launch N Mineflayer agents in tmux (v2 architecture)
# Usage: ./launch-agents.sh [num_agents] [server_host] [server_port]
# Default: 2 agents (luna + john), localhost, 25565
#
# v2.0 architecture: Mineflayer bots connect directly — no Java client needed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Agent roster ──
AGENT_NAMES=(luna john)

# ── Arguments ──
NUM_AGENTS="${1:-2}"
MC_HOST="${2:-localhost}"
MC_PORT="${3:-25565}"

# Clamp to available names
MAX_AGENTS="${#AGENT_NAMES[@]}"
if [ "$NUM_AGENTS" -gt "$MAX_AGENTS" ]; then
    echo "[launch-agents] Clamping to $MAX_AGENTS agents (extend AGENT_NAMES to add more)"
    NUM_AGENTS="$MAX_AGENTS"
fi
if [ "$NUM_AGENTS" -lt 1 ]; then
    echo "ERROR: num_agents must be at least 1"
    exit 1
fi

# ── Load env (try Glass path first, then local) ──
if [ -f /opt/hermescraft/agent/.env ]; then
    set -a
    source /opt/hermescraft/agent/.env
    set +a
    echo "[launch-agents] Loaded env from /opt/hermescraft/agent/.env (Glass)"
fi
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    echo "[launch-agents] Loaded env from $SCRIPT_DIR/.env (local override)"
fi

# ── Env var defaults ──
# Qwen3.5-35B-A3B is natively multimodal — one model handles text + vision + background brain.
# No separate VLM process needed. All endpoints point at the same vLLM instance.
VLLM_URL="${VLLM_URL:-http://localhost:8000/v1}"
VLLM_API_KEY="${VLLM_API_KEY:-not-needed}"
MODEL_NAME="${MODEL_NAME:-Qwen3.5-35B-A3B}"
BACKGROUND_BRAIN_URL="${BACKGROUND_BRAIN_URL:-$VLLM_URL}"
BACKGROUND_MODEL_NAME="${BACKGROUND_MODEL_NAME:-$MODEL_NAME}"
TICK_MS="${TICK_MS:-6000}"
TEMPERATURE="${TEMPERATURE:-0.6}"
MAX_TOKENS="${MAX_TOKENS:-768}"
VISION_URL="${VISION_URL:-$VLLM_URL}"
VISION_MODEL="${VISION_MODEL:-$MODEL_NAME}"

if [ "$VLLM_URL" = "http://localhost:8000/v1" ]; then
    echo "[launch-agents] Using localhost LLM — ensure vLLM is running with $MODEL_NAME"
fi

# ── Install deps if needed ──
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[launch-agents] Installing dependencies..."
    (cd "$SCRIPT_DIR" && npm install)
fi

echo "============================================"
echo "  HermesCraft Agents — ${NUM_AGENTS} of ${MAX_AGENTS}"
echo "============================================"
echo "  Agents:    ${AGENT_NAMES[*]:0:$NUM_AGENTS}"
echo "  Server:    $MC_HOST:$MC_PORT"
echo "  Model:     $MODEL_NAME"
echo "  LLM URL:   $VLLM_URL"
echo "  Tick:      ${TICK_MS}ms"
echo "  Mode:      open_ended"
echo "  Stagger:   5s between agents"
echo "============================================"
echo ""

SESSION="hermescraft-agents"

# Kill existing session
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1

# Create session with first agent's window
FIRST_AGENT="${AGENT_NAMES[0]}"
tmux new-session -d -s "$SESSION" -n "$FIRST_AGENT"

# ── Data-driven agent launch loop ──
for i in $(seq 0 $((NUM_AGENTS - 1))); do
    AGENT_NAME="${AGENT_NAMES[$i]}"

    # Open window (first window already created above)
    if [ "$i" -gt 0 ]; then
        tmux new-window -t "$SESSION" -n "$AGENT_NAME"
    fi

    # Build launch command via HEREDOC with placeholder substitution
    AGENT_CMD="$(cat <<'HEREDOC'
echo '=== AGENT_NAME_PLACEHOLDER — starting ==='
echo 'Starting in 3s...'
sleep 3
while true; do
    AGENT_NAME='AGENT_NAME_PLACEHOLDER' \
    MC_USERNAME='AGENT_NAME_PLACEHOLDER' \
    MC_HOST='MC_HOST_PLACEHOLDER' \
    MC_PORT='MC_PORT_PLACEHOLDER' \
    VLLM_URL='VLLM_URL_PLACEHOLDER' \
    VLLM_API_KEY='VLLM_API_KEY_PLACEHOLDER' \
    MODEL_NAME='MODEL_NAME_PLACEHOLDER' \
    BACKGROUND_BRAIN_URL='BG_URL_PLACEHOLDER' \
    BACKGROUND_MODEL_NAME='BG_MODEL_PLACEHOLDER' \
    AGENT_MODE='open_ended' \
    TICK_MS='TICK_MS_PLACEHOLDER' \
    TEMPERATURE='TEMPERATURE_PLACEHOLDER' \
    MAX_TOKENS='MAX_TOKENS_PLACEHOLDER' \
    VISION_URL='VISION_URL_PLACEHOLDER' \
    VISION_MODEL='VISION_MODEL_PLACEHOLDER' \
        node SCRIPT_DIR_PLACEHOLDER/start.js
    CODE=$?
    [ $CODE -eq 0 ] && break                    # clean shutdown — stop
    [ $CODE -eq 42 ] && { echo "[!] AGENT_NAME_PLACEHOLDER scheduled restart — relaunching..."; continue; }
    echo "[!] AGENT_NAME_PLACEHOLDER crashed (exit $CODE) — restarting in 5s..."
    sleep 5
done
HEREDOC
)"

    # Replace placeholders
    AGENT_CMD="${AGENT_CMD//AGENT_NAME_PLACEHOLDER/$AGENT_NAME}"
    AGENT_CMD="${AGENT_CMD//MC_HOST_PLACEHOLDER/$MC_HOST}"
    AGENT_CMD="${AGENT_CMD//MC_PORT_PLACEHOLDER/$MC_PORT}"
    AGENT_CMD="${AGENT_CMD//VLLM_URL_PLACEHOLDER/$VLLM_URL}"
    AGENT_CMD="${AGENT_CMD//VLLM_API_KEY_PLACEHOLDER/$VLLM_API_KEY}"
    AGENT_CMD="${AGENT_CMD//MODEL_NAME_PLACEHOLDER/$MODEL_NAME}"
    AGENT_CMD="${AGENT_CMD//BG_URL_PLACEHOLDER/$BACKGROUND_BRAIN_URL}"
    AGENT_CMD="${AGENT_CMD//BG_MODEL_PLACEHOLDER/$BACKGROUND_MODEL_NAME}"
    AGENT_CMD="${AGENT_CMD//TICK_MS_PLACEHOLDER/$TICK_MS}"
    AGENT_CMD="${AGENT_CMD//TEMPERATURE_PLACEHOLDER/$TEMPERATURE}"
    AGENT_CMD="${AGENT_CMD//MAX_TOKENS_PLACEHOLDER/$MAX_TOKENS}"
    AGENT_CMD="${AGENT_CMD//VISION_URL_PLACEHOLDER/$VISION_URL}"
    AGENT_CMD="${AGENT_CMD//VISION_MODEL_PLACEHOLDER/$VISION_MODEL}"
    AGENT_CMD="${AGENT_CMD//SCRIPT_DIR_PLACEHOLDER/$SCRIPT_DIR}"

    tmux send-keys -t "$SESSION:$AGENT_NAME" "$AGENT_CMD" Enter

    # 5s stagger between agents (skip after last agent)
    if [ "$i" -lt $((NUM_AGENTS - 1)) ]; then
        echo "[launch-agents] $AGENT_NAME launched — waiting 5s before next agent..."
        sleep 5
    fi
done

echo ""
echo "============================================"
echo "  All ${NUM_AGENTS} agents launched!"
echo "============================================"
echo ""
echo "  tmux attach -t $SESSION"
echo ""
echo "  Windows:"
for i in $(seq 0 $((NUM_AGENTS - 1))); do
    echo "    ${AGENT_NAMES[$i]}"
done
echo ""
echo "  Controls:"
echo "    Ctrl+B, n/p    — next/prev window"
echo "    Ctrl+B, w      — window list"
echo "    Ctrl+B, d      — detach"
echo "    tmux kill-session -t $SESSION  — stop all agents"
echo ""
