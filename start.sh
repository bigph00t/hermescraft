#!/bin/bash
# HermesCraft — Single-command launcher for 24/7 operation
# Usage: ./start.sh
#
# Prerequisites:
#   1. GPU with enough VRAM for Hermes 4.3 36B AWQ (~24GB)
#   2. Minecraft client running with HermesBridge + Baritone mods
#   3. npm install (run once)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
  set -a; source .env; set +a
fi

# Defaults (override via .env or environment)
VLLM_URL="${VLLM_URL:-http://localhost:8000/v1}"
VLLM_PORT="${VLLM_PORT:-8000}"
MODEL_NAME="${MODEL_NAME:-NousResearch/Hermes-4.3-Llama-3.3-36B-AWQ}"
MOD_URL="${MOD_URL:-http://localhost:3001}"
TICK_MS="${TICK_MS:-3000}"
GPU_MEM="${GPU_MEM:-0.90}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-8192}"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[HermesCraft]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; }

# ── Cleanup on exit ──
VLLM_PID=""
AGENT_PID=""

cleanup() {
  log "Shutting down..."
  [ -n "$AGENT_PID" ] && kill "$AGENT_PID" 2>/dev/null && log "Agent stopped"
  [ -n "$VLLM_PID" ] && kill "$VLLM_PID" 2>/dev/null && log "vLLM stopped"
  rm -f /tmp/hermescraft-pids
  log "Goodbye."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Banner ──
echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         ⚡ HermesCraft ⚡            ║${NC}"
echo -e "${BOLD}║   Autonomous AI Minecraft Agent      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
log "Model:  $MODEL_NAME"
log "vLLM:   $VLLM_URL"
log "Mod:    $MOD_URL"
log "Tick:   ${TICK_MS}ms"
echo ""

# ── Step 1: npm install if needed ──
if [ ! -d node_modules ]; then
  log "Installing dependencies..."
  npm install --production
fi

# ── Step 2: Start vLLM (auto-restart forever) ──
vllm_loop() {
  while true; do
    log "Starting vLLM server..."
    python3 -m vllm.entrypoints.openai.api_server \
      --model "$MODEL_NAME" \
      --host 0.0.0.0 \
      --port "$VLLM_PORT" \
      --max-model-len "$MAX_MODEL_LEN" \
      --quantization awq \
      --gpu-memory-utilization "$GPU_MEM" \
      --enable-auto-tool-choice \
      --tool-call-parser hermes \
      2>&1 | while IFS= read -r line; do echo "[vLLM] $line"; done
    err "vLLM crashed — restarting in 5s..."
    sleep 5
  done
}

# Check if vLLM is already running
if curl -s "http://localhost:${VLLM_PORT}/v1/models" > /dev/null 2>&1; then
  ok "vLLM already running"
else
  vllm_loop &
  VLLM_PID=$!
  log "vLLM launcher PID: $VLLM_PID"

  # Wait for vLLM to be ready (model loading takes a while)
  log "Waiting for vLLM to load model (this can take 2-5 minutes)..."
  VLLM_WAIT=0
  while ! curl -s "http://localhost:${VLLM_PORT}/v1/models" > /dev/null 2>&1; do
    sleep 5
    VLLM_WAIT=$((VLLM_WAIT + 5))
    if [ $VLLM_WAIT -ge 600 ]; then
      err "vLLM failed to start after 10 minutes"
      exit 1
    fi
    if [ $((VLLM_WAIT % 30)) -eq 0 ]; then
      log "Still waiting for vLLM... (${VLLM_WAIT}s)"
    fi
  done
  ok "vLLM ready"
fi

# ── Step 3: Wait for Minecraft client + HermesBridge mod ──
log "Waiting for HermesBridge mod (Minecraft client must be running)..."
MOD_WAIT=0
while ! curl -s "${MOD_URL}/health" > /dev/null 2>&1; do
  sleep 3
  MOD_WAIT=$((MOD_WAIT + 3))
  if [ $((MOD_WAIT % 30)) -eq 0 ]; then
    warn "HermesBridge not responding at ${MOD_URL}/health — is Minecraft running? (${MOD_WAIT}s)"
  fi
done
ok "HermesBridge connected"

# ── Step 4: Start agent (auto-restart forever) ──
echo ""
log "Launching Hermes agent..."
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# Save PIDs
echo "$VLLM_PID $$" > /tmp/hermescraft-pids

# Agent auto-restart loop (foreground)
while true; do
  VLLM_URL="$VLLM_URL" \
  MOD_URL="$MOD_URL" \
  MODEL_NAME="$MODEL_NAME" \
  TICK_MS="$TICK_MS" \
    node agent/index.js

  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    log "Agent exited cleanly"
    break
  fi
  err "Agent crashed (exit $EXIT_CODE) — restarting in 3s..."
  sleep 3
done
