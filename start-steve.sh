#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TERMINAL="$(command -v x-terminal-emulator || command -v gnome-terminal || command -v konsole || true)"

read -rp "Minecraft LAN port: " MC_PORT
if [[ -z "${MC_PORT:-}" ]]; then
  echo "No port provided. Aborting."
  exit 1
fi
if ! [[ "$MC_PORT" =~ ^[0-9]+$ ]]; then
  echo "Port must be numeric."
  exit 1
fi

STEVE_HOME="$HOME/.hermes-landfolk-steve"
mkdir -p "$STEVE_HOME/memories" "$STEVE_HOME/sessions"
cp "$SCRIPT_DIR/SOUL-landfolk.md" "$STEVE_HOME/SOUL.md"

if [ -f "$HOME/.hermes/config.yaml" ]; then
  cp "$HOME/.hermes/config.yaml" "$STEVE_HOME/config.yaml"
  sed -i 's/max_iterations: [0-9]*/max_iterations: 200/' "$STEVE_HOME/config.yaml" || true
  sed -i 's/default: .*/default: claude-sonnet-4-20250514/' "$STEVE_HOME/config.yaml" || true
  sed -i 's/provider: .*/provider: anthropic/' "$STEVE_HOME/config.yaml" || true
  sed -i 's/memory_enabled: false/memory_enabled: true/' "$STEVE_HOME/config.yaml" || true
  sed -i 's/user_profile_enabled: false/user_profile_enabled: true/' "$STEVE_HOME/config.yaml" || true
fi

for f in auth.json auth.lock; do
  [ -f "$HOME/.hermes/$f" ] && ln -sf "$HOME/.hermes/$f" "$STEVE_HOME/$f"
done

if [ -f "$HOME/.hermes/.env" ]; then
  if [ -L "$STEVE_HOME/.env" ]; then rm -f "$STEVE_HOME/.env"; fi
  cp "$HOME/.hermes/.env" "$STEVE_HOME/.env"
fi

chmod +x "$SCRIPT_DIR/scripts/run-landfolk-agent.sh" "$SCRIPT_DIR/scripts/run-steve-bot.sh"

pkill -f 'MC_USERNAME=Steve' 2>/dev/null || true
pkill -f '/tmp/bot-steve.log' 2>/dev/null || true
sleep 1

if [ -n "$TERMINAL" ]; then
  echo "Opening Steve terminal..."
  "$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-steve-bot.sh '$MC_PORT' & sleep 3; ./scripts/run-landfolk-agent.sh Steve 3001 prompts/landfolk/steve.md '$STEVE_HOME'; exec bash"
else
  echo "No terminal emulator found. Starting Steve in this terminal."
  cd "$SCRIPT_DIR"
  ./scripts/run-steve-bot.sh "$MC_PORT" &
  sleep 3
  ./scripts/run-landfolk-agent.sh Steve 3001 prompts/landfolk/steve.md "$STEVE_HOME"
fi
