#!/usr/bin/env bash
# Spawn all Landfolk agent terminals
# Usage: ./spawn-agents.sh
# Assumes bot bodies already running on ports 3001-3005

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL="claude-sonnet-4-6"

spawn() {
  local NAME="$1" PORT="$2"
  konsole --noclose -e bash -c "
    unset ANTHROPIC_API_KEY ANTHROPIC_TOKEN
    cd '$SCRIPT_DIR'
    HERMES_HOME=\$HOME/.hermes-landfolk-${NAME,,} \
    MC_API_URL=http://localhost:$PORT \
    MC_USERNAME=$NAME \
    hermes chat --yolo -q \"\$(cat prompts/landfolk/${NAME,,}.md)\" -m $MODEL --provider anthropic
    exec bash
  " &
  sleep 0.5
}

spawn Steve 3001
spawn Reed  3002
spawn Moss  3003
spawn Flint 3004
spawn Ember 3005

echo "All 5 agent terminals spawned."
