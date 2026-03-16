#!/usr/bin/env bash
set -euo pipefail

MC_PORT="${1:?Usage: run-steve-bot.sh MC_PORT}"
MC_HOST="${MC_HOST:-localhost}"
API_PORT="${API_PORT:-3001}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BOT_DIR="$SCRIPT_DIR/bot"

cd "$BOT_DIR"

echo "[Steve bot] starting Steve on API ${API_PORT} -> ${MC_HOST}:${MC_PORT}"
MC_HOST="$MC_HOST" MC_PORT="$MC_PORT" MC_USERNAME="Steve" API_PORT="$API_PORT" node server.js > /tmp/bot-steve.log 2>&1
