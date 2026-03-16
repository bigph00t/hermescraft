#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HermesCraft Civilization — N Hermes Agents, Full Autonomy
#
# Each agent gets:
#   - Its own HERMES_HOME (~/.hermes-<name>) with persistent memory
#   - Its own SOUL.md (SOUL-civilization.md + character personality)
#   - Its own mc CLI pointed at its bot server
#   - Session history that carries across restarts
#
# Usage:
#   ./civilization.sh                   # launch all 7 on port 12345
#   ./civilization.sh --port 25565      # custom MC port
#   ./civilization.sh --bots-only       # just start bot servers
#   ./civilization.sh --agents-only     # agents only (bots already running)
#   ./civilization.sh --agents 3        # only launch first N agents
#   ./civilization.sh --model gpt-4o    # use a specific model
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"
BIN_DIR="$SCRIPT_DIR/bin"
PROMPT_DIR="$SCRIPT_DIR/prompts"
SOUL_FILE="$SCRIPT_DIR/SOUL-civilization.md"

# Preserve the currently working Anthropic env from the calling shell.
# Do not override it with stale on-disk values.
MC_HOST="${MC_HOST:-localhost}"
MC_PORT="${MC_PORT:-12345}"
BASE_API_PORT=3001

# Agent definitions: name:direction
# Direction is where they head initially to spread out
ALL_AGENTS=(
  "Marcus:northeast"
  "Sarah:east"
  "Jin:south"
  "Dave:west"
  "Lisa:north"
  "Tommy:southeast"
  "Elena:northwest"
)

PIDS=()
BOT_PIDS=()
BOTS_ONLY=false
AGENTS_ONLY=false
NUM_AGENTS=${#ALL_AGENTS[@]}
MODEL=""
PROVIDER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bots-only) BOTS_ONLY=true; shift ;;
    --agents-only) AGENTS_ONLY=true; shift ;;
    --port) MC_PORT="$2"; shift 2 ;;
    --agents) NUM_AGENTS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --help|-h)
      echo "HermesCraft Civilization — Multi-Agent Autonomous Minecraft"
      echo ""
      echo "Usage: ./civilization.sh [options]"
      echo ""
      echo "Options:"
      echo "  --port PORT       Minecraft server port (default: 12345)"
      echo "  --agents N        Number of agents to launch (default: 7)"
      echo "  --model MODEL     LLM model to use (default: hermes default)"
      echo "  --provider PROV   LLM provider (openrouter, anthropic, etc)"
      echo "  --bots-only       Start bot servers only"
      echo "  --agents-only     Start agents only (bots already running)"
      echo ""
      echo "Environment:"
      echo "  MC_HOST           Minecraft server host (default: localhost)"
      echo "  MC_PORT           Minecraft server port (default: 12345)"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Default to Sonnet for civilization unless explicitly overridden.
if [ -z "$MODEL" ] && [ -z "$PROVIDER" ] && [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  MODEL="claude-sonnet-4-20250514"
  PROVIDER="anthropic"
fi

# Use only the first N agents
AGENTS=("${ALL_AGENTS[@]:0:$NUM_AGENTS}")

cleanup() {
  echo ""
  echo "  Shutting down civilization..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  if [ "$AGENTS_ONLY" = false ]; then
    for pid in "${BOT_PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
  fi
  wait 2>/dev/null
  echo "  Civilization ended."
}
trap cleanup EXIT INT TERM

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║     HERMESCRAFT CIVILIZATION SIMULATOR        ║"
echo "  ║     ${#AGENTS[@]} Agents — Persistent Memory — Full AI    ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
echo "  Minecraft: $MC_HOST:$MC_PORT"
echo ""

# Ensure mc is on PATH
export PATH="$BIN_DIR:$PATH"

# Find hermes
HERMES=""
for c in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
  if command -v "$c" &>/dev/null || [ -x "$c" ]; then HERMES="$c"; break; fi
done
[ -z "$HERMES" ] && { echo "  ✗ hermes CLI not found. pip install hermes-agent"; exit 1; }

# Ensure bot deps installed
[ -d "$BOT_DIR/node_modules" ] || { echo "  Installing bot deps..."; cd "$BOT_DIR" && npm install --no-audit --no-fund 2>&1 | tail -2; cd "$SCRIPT_DIR"; }

# ─── Start Bot Servers ───
if [ "$AGENTS_ONLY" = false ]; then
  echo "  Starting bot servers..."
  for i in "${!AGENTS[@]}"; do
    IFS=':' read -r name direction <<< "${AGENTS[$i]}"
    PORT=$((BASE_API_PORT + i))

    if curl -sf "http://localhost:$PORT/health" &>/dev/null; then
      echo "    ✓ $name already running on port $PORT"
    else
      cd "$BOT_DIR"
      MC_HOST="$MC_HOST" MC_PORT="$MC_PORT" MC_USERNAME="$name" API_PORT="$PORT" \
        node server.js > "/tmp/bot-${name,,}.log" 2>&1 &
      BOT_PIDS+=($!)
      cd "$SCRIPT_DIR"
      echo "    ⏳ $name starting on port $PORT..."
      sleep 2
    fi
  done

  # Wait for all bots to connect
  echo ""
  echo "  Waiting for connections..."
  sleep 5
  FAILED=()
  for i in "${!AGENTS[@]}"; do
    IFS=':' read -r name direction <<< "${AGENTS[$i]}"
    PORT=$((BASE_API_PORT + i))
    CONN=$(curl -sf "http://localhost:$PORT/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('connected',False))" 2>/dev/null || echo "False")
    if [ "$CONN" = "True" ]; then
      echo "    ✓ $name connected"
    else
      echo "    ✗ $name failed to connect (check /tmp/bot-${name,,}.log)"
      FAILED+=("$name")
    fi
  done
  if [ ${#FAILED[@]} -gt 0 ]; then
    echo ""
    echo "  ✗ Aborting agent launch. These bot bodies are not connected: ${FAILED[*]}"
    echo "    Fix the Minecraft/server connection first, then rerun ./civilization.sh"
    exit 1
  fi
fi

if [ "$AGENTS_ONLY" = true ]; then
  echo ""
  echo "  Validating existing bot servers before agent launch..."
  FAILED=()
  for i in "${!AGENTS[@]}"; do
    IFS=':' read -r name direction <<< "${AGENTS[$i]}"
    PORT=$((BASE_API_PORT + i))
    CONN=$(curl -sf "http://localhost:$PORT/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('connected',False))" 2>/dev/null || echo "False")
    if [ "$CONN" = "True" ]; then
      echo "    ✓ $name bot connected on port $PORT"
    else
      echo "    ✗ $name bot missing/disconnected on port $PORT"
      FAILED+=("$name")
    fi
  done
  if [ ${#FAILED[@]} -gt 0 ]; then
    echo ""
    echo "  ✗ Aborting agent launch. These existing bot bodies are not ready: ${FAILED[*]}"
    exit 1
  fi
fi

[ "$BOTS_ONLY" = true ] && { echo ""; echo "  Bot servers running. Press Ctrl+C to stop."; wait; exit 0; }

# ─── Setup Per-Agent HERMES_HOME with SOUL ───
echo ""
echo "  Setting up agent identities..."

for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name direction <<< "${AGENTS[$i]}"
  name_lower="${name,,}"
  AGENT_HOME="$HOME/.hermes-${name_lower}"
  PROMPT_FILE="$PROMPT_DIR/${name_lower}.md"

  # Create agent home if needed
  mkdir -p "$AGENT_HOME/memories" "$AGENT_HOME/sessions"

  # Install SOUL.md = SOUL-civilization.md (behavior rules)
  cp "$SOUL_FILE" "$AGENT_HOME/SOUL.md"

  # Copy base config and adjust for autonomous play
  if [ -f "$HOME/.hermes/config.yaml" ]; then
    cp "$HOME/.hermes/config.yaml" "$AGENT_HOME/config.yaml"
    # Bump max_iterations so agents live longer
    sed -i 's/max_iterations: [0-9]*/max_iterations: 200/' "$AGENT_HOME/config.yaml"
    # Default to sonnet to avoid $$$ with 7 agents on opus
    sed -i 's/default: claude-opus-4-6/default: claude-sonnet-4-20250514/' "$AGENT_HOME/config.yaml"
    # Enable memory for each agent
    sed -i 's/memory_enabled: false/memory_enabled: true/' "$AGENT_HOME/config.yaml"
    sed -i 's/user_profile_enabled: false/user_profile_enabled: true/' "$AGENT_HOME/config.yaml"
  fi

  # Link auth files from main hermes
  for f in .env auth.json auth.lock; do
    [ -f "$HOME/.hermes/$f" ] && ln -sf "$HOME/.hermes/$f" "$AGENT_HOME/$f" 2>/dev/null
  done

  echo "    ✓ $name → $AGENT_HOME"
done

# ─── Launch Hermes Agents ───
echo ""
echo "  Launching agents..."
echo ""

for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name direction <<< "${AGENTS[$i]}"
  name_lower="${name,,}"
  PORT=$((BASE_API_PORT + i))
  AGENT_HOME="$HOME/.hermes-${name_lower}"
  PROMPT_FILE="$PROMPT_DIR/${name_lower}.md"

  # Read the character prompt
  PROMPT=$(cat "$PROMPT_FILE")

  echo "  🧠 $name (port:$PORT, home:$AGENT_HOME)"

  HERMES_ARGS=(chat --yolo -q "$PROMPT")
  [ -n "$MODEL" ] && HERMES_ARGS+=(-m "$MODEL")
  [ -n "$PROVIDER" ] && HERMES_ARGS+=(--provider "$PROVIDER")

  HERMES_HOME="$AGENT_HOME" \
  MC_API_URL="http://localhost:$PORT" \
  MC_USERNAME="$name" \
    "$HERMES" "${HERMES_ARGS[@]}" \
    > "/tmp/agent-${name_lower}.log" 2>&1 &
  PIDS+=($!)

  sleep 5  # stagger launches to avoid LLM rate limits
done

echo ""
echo "  ═══════════════════════════════════════════════"
echo "  All ${#AGENTS[@]} agents launched!"
echo ""
echo "  📋 Watch agent logs:"
for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name direction <<< "${AGENTS[$i]}"
  echo "     tail -f /tmp/agent-${name,,}.log"
done
echo ""
echo "  📋 Watch bot logs:"
for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name direction <<< "${AGENTS[$i]}"
  echo "     tail -f /tmp/bot-${name,,}.log"
done
echo ""
echo "  💬 Read in-game chat (from any bot's perspective):"
echo "     MC_API_URL=http://localhost:3001 mc read_chat"
echo ""
echo "  🧠 Check agent memory:"
for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name direction <<< "${AGENTS[$i]}"
  echo "     cat ~/.hermes-${name,,}/memories/MEMORY.md"
done
echo ""
echo "  🛑 Stop: Ctrl+C"
echo "  ═══════════════════════════════════════════════"
echo ""

wait
