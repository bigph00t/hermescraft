#!/usr/bin/env bash
# HermesCraft Landfolk — 5 in-world characters for a player's LAN world
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"
BIN_DIR="$SCRIPT_DIR/bin"
PROMPT_DIR="$SCRIPT_DIR/prompts/landfolk"
SOUL_FILE="$SCRIPT_DIR/SOUL-landfolk.md"

# Preserve the currently working Anthropic env from the calling shell.
# Do not override it with stale on-disk values.
MC_HOST="${MC_HOST:-localhost}"
MC_PORT="${MC_PORT:-25565}"
BASE_API_PORT=3001
MODEL="${MODEL:-claude-sonnet-4-20250514}"
PROVIDER="${PROVIDER:-anthropic}"
BOTS_ONLY=false
AGENTS_ONLY=false

AGENTS=(
  "Steve:friend"
  "Reed:water"
  "Moss:garden"
  "Flint:stone"
  "Ember:fire"
)

PIDS=()
BOT_PIDS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bots-only) BOTS_ONLY=true; shift ;;
    --agents-only) AGENTS_ONLY=true; shift ;;
    --port) MC_PORT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --help|-h)
      echo "Landfolk launcher"
      echo "Usage: ./landfolk.sh [--port LAN_PORT] [--agents-only] [--bots-only]"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

cleanup() {
  echo ""
  echo "  Stopping landfolk..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  if [ "$AGENTS_ONLY" = false ]; then
    for pid in "${BOT_PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

export PATH="$BIN_DIR:$PATH"
HERMES=""
for c in hermes "$HOME/.local/bin/hermes" /usr/local/bin/hermes; do
  if command -v "$c" &>/dev/null || [ -x "$c" ]; then HERMES="$c"; break; fi
done
[ -z "$HERMES" ] && { echo "hermes CLI not found"; exit 1; }

[ -d "$BOT_DIR/node_modules" ] || { echo "Installing bot deps..."; cd "$BOT_DIR" && npm install --no-audit --no-fund; cd "$SCRIPT_DIR"; }

if [ "$AGENTS_ONLY" = false ]; then
  echo "Starting landfolk bot bodies on $MC_HOST:$MC_PORT"
  for i in "${!AGENTS[@]}"; do
    IFS=':' read -r name role <<< "${AGENTS[$i]}"
    PORT=$((BASE_API_PORT + i))
    cd "$BOT_DIR"
    MC_HOST="$MC_HOST" MC_PORT="$MC_PORT" MC_USERNAME="$name" API_PORT="$PORT" node server.js > "/tmp/bot-${name,,}.log" 2>&1 &
    BOT_PIDS+=($!)
    cd "$SCRIPT_DIR"
    sleep 2
  done
  sleep 5
fi

FAILED=()
for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name role <<< "${AGENTS[$i]}"
  PORT=$((BASE_API_PORT + i))
  CONN=$(curl -sf "http://localhost:$PORT/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('connected',False))" 2>/dev/null || echo "False")
  if [ "$CONN" != "True" ]; then
    FAILED+=("$name")
  fi
done
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "These bot bodies are not connected: ${FAILED[*]}"
  exit 1
fi

[ "$BOTS_ONLY" = true ] && { echo "Bots ready."; wait; exit 0; }

echo "Launching landfolk agents with $MODEL via $PROVIDER"
for i in "${!AGENTS[@]}"; do
  IFS=':' read -r name role <<< "${AGENTS[$i]}"
  name_lower="${name,,}"
  PORT=$((BASE_API_PORT + i))
  AGENT_HOME="$HOME/.hermes-landfolk-${name_lower}"
  PROMPT_FILE="$PROMPT_DIR/${name_lower}.md"

  mkdir -p "$AGENT_HOME/memories" "$AGENT_HOME/sessions"
  cp "$SOUL_FILE" "$AGENT_HOME/SOUL.md"
  if [ -f "$HOME/.hermes/config.yaml" ]; then
    cp "$HOME/.hermes/config.yaml" "$AGENT_HOME/config.yaml"
    sed -i 's/max_iterations: [0-9]*/max_iterations: 200/' "$AGENT_HOME/config.yaml"
    sed -i 's/memory_enabled: false/memory_enabled: true/' "$AGENT_HOME/config.yaml"
    sed -i 's/user_profile_enabled: false/user_profile_enabled: true/' "$AGENT_HOME/config.yaml"
  fi
  for f in .env auth.json auth.lock; do
    [ -f "$HOME/.hermes/$f" ] && ln -sf "$HOME/.hermes/$f" "$AGENT_HOME/$f" 2>/dev/null
  done

  PROMPT=$(cat "$PROMPT_FILE")
  HERMES_ARGS=(chat --yolo -q "$PROMPT" -m "$MODEL" --provider "$PROVIDER")
  HERMES_HOME="$AGENT_HOME" MC_API_URL="http://localhost:$PORT" MC_USERNAME="$name" "$HERMES" "${HERMES_ARGS[@]}" > "/tmp/agent-${name_lower}.log" 2>&1 &
  PIDS+=($!)
  echo "  🧠 $name on port $PORT"
  sleep 4
done

echo ""
echo "Landfolk launched."
echo "Use: ./landfolk.sh --port <LAN_PORT>"
wait
