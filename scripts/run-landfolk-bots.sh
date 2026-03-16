#!/usr/bin/env bash
set -euo pipefail

MC_HOST="${MC_HOST:-localhost}"
MC_PORT="${1:?Usage: run-landfolk-bots.sh MC_PORT}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"

cd "$BOT_DIR"

run_bot() {
  local name="$1"
  local api_port="$2"
  echo "[bot] starting $name on API $api_port -> $MC_HOST:$MC_PORT"
  MC_HOST="$MC_HOST" MC_PORT="$MC_PORT" MC_USERNAME="$name" API_PORT="$api_port" node server.js > "/tmp/bot-${name,,}.log" 2>&1 &
}

run_bot Steve 3001
sleep 1
run_bot Reed 3002
sleep 1
run_bot Moss 3003
sleep 1
run_bot Flint 3004
sleep 1
run_bot Ember 3005

echo
printf '[bot] started landfolk bodies on MC port %s\n' "$MC_PORT"
echo '[bot] logs: /tmp/bot-steve.log ... /tmp/bot-ember.log'
wait
