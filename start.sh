#!/usr/bin/env bash
# Start all Landfolk bots + agents
# Usage: ./start.sh [MC_PORT]
# Example: ./start.sh 12345

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MC_PORT="${1:-${MC_PORT:-25565}}"
MODEL="claude-sonnet-4-6"
NAMES=(Steve Reed Moss Flint Ember)

echo "Killing stale bots..."
pkill -f "node.*server.js" 2>/dev/null || true
sleep 1

echo "Starting bot bodies on MC port $MC_PORT..."
cd "$SCRIPT_DIR/bot"
for i in "${!NAMES[@]}"; do
  NAME="${NAMES[$i]}"
  PORT=$((3001 + i))
  MC_HOST=localhost MC_PORT="$MC_PORT" MC_USERNAME="$NAME" API_PORT="$PORT" \
    node server.js > "/tmp/bot-${NAME,,}.log" 2>&1 &
  echo "  $NAME → port $PORT"
done
cd "$SCRIPT_DIR"

echo "Waiting for bots to connect..."
for attempt in $(seq 1 15); do
  all_up=true
  for i in "${!NAMES[@]}"; do
    PORT=$((3001 + i))
    connected=$(curl -sf "http://localhost:$PORT/health" 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('connected',False))" 2>/dev/null || echo "False")
    [ "$connected" != "True" ] && all_up=false
  done
  [ "$all_up" = true ] && break
  sleep 2
done

echo ""
echo "Bot status:"
for i in "${!NAMES[@]}"; do
  PORT=$((3001 + i))
  STATUS=$(curl -sf "http://localhost:$PORT/health" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('connected' if d.get('connected') else 'NOT connected')" 2>/dev/null || echo "DOWN")
  echo "  ${NAMES[$i]}: $STATUS"
done

echo ""
echo "Syncing SOUL + config..."
for i in "${!NAMES[@]}"; do
  NAME="${NAMES[$i]}"
  AGENT_HOME="$HOME/.hermes-landfolk-${NAME,,}"
  mkdir -p "$AGENT_HOME"
  cp "$SCRIPT_DIR/SOUL-landfolk.md" "$AGENT_HOME/SOUL.md"
  if [ -f "$AGENT_HOME/config.yaml" ]; then
    sed -i "s/default: claude-sonnet-4-20250514/default: $MODEL/" "$AGENT_HOME/config.yaml"
    sed -i "s/default: claude-opus-4-6/default: $MODEL/" "$AGENT_HOME/config.yaml"
    sed -i "s/max_iterations: [0-9]*/max_iterations: 999999/" "$AGENT_HOME/config.yaml"
  fi
done

echo ""
echo "Spawning agents..."
for i in "${!NAMES[@]}"; do
  NAME="${NAMES[$i]}"
  NAME_LOWER="${NAME,,}"
  PORT=$((3001 + i))
  AGENT_HOME="$HOME/.hermes-landfolk-${NAME_LOWER}"

  konsole --noclose -e bash -c "
    unset ANTHROPIC_API_KEY ANTHROPIC_TOKEN
    cd '$SCRIPT_DIR'
    HERMES_HOME=$AGENT_HOME \
    MC_API_URL=http://localhost:$PORT \
    MC_USERNAME=$NAME \
    hermes chat --yolo -q \"\$(cat prompts/landfolk/${NAME_LOWER}.md)\" -m $MODEL --provider anthropic
    exec bash
  " &
  sleep 0.5
done

echo "All done."
