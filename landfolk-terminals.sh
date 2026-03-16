#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-}"
if [ -z "$PORT" ]; then
  echo "Usage: ./landfolk-terminals.sh <LAN_PORT>"
  exit 1
fi

TERMINAL="$(command -v x-terminal-emulator || command -v gnome-terminal || command -v konsole || true)"
[ -z "$TERMINAL" ] && { echo "No terminal emulator found"; exit 1; }

prepare_home() {
  local name_lower="$1"
  local home_dir="$HOME/.hermes-landfolk-${name_lower}"
  mkdir -p "$home_dir/memories" "$home_dir/sessions"
  cp "$SCRIPT_DIR/SOUL-landfolk.md" "$home_dir/SOUL.md"
  if [ -f "$HOME/.hermes/config.yaml" ]; then
    cp "$HOME/.hermes/config.yaml" "$home_dir/config.yaml"
    sed -i 's/max_iterations: [0-9]*/max_iterations: 200/' "$home_dir/config.yaml" || true
    sed -i 's/default: .*/default: claude-sonnet-4-20250514/' "$home_dir/config.yaml" || true
    sed -i 's/provider: .*/provider: anthropic/' "$home_dir/config.yaml" || true
    sed -i 's/memory_enabled: false/memory_enabled: true/' "$home_dir/config.yaml" || true
    sed -i 's/user_profile_enabled: false/user_profile_enabled: true/' "$home_dir/config.yaml" || true
  fi
  for f in auth.json auth.lock; do
    [ -f "$HOME/.hermes/$f" ] && ln -sf "$HOME/.hermes/$f" "$home_dir/$f"
  done
  if [ -L "$home_dir/.env" ]; then
    rm -f "$home_dir/.env"
  fi
  if [ -f "$HOME/.hermes/.env" ]; then
    src_env="$(readlink -f "$HOME/.hermes/.env")"
    dst_env="$(readlink -f "$home_dir/.env" 2>/dev/null || true)"
    if [ "$src_env" != "$dst_env" ]; then
      cp "$HOME/.hermes/.env" "$home_dir/.env"
    fi
  fi
}

for n in steve reed moss flint ember; do
  prepare_home "$n"
done

chmod +x "$SCRIPT_DIR/scripts/run-landfolk-agent.sh" "$SCRIPT_DIR/scripts/run-landfolk-bots.sh"

echo "Spawning bot-body terminal..."
"$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-landfolk-bots.sh '$PORT'; exec bash"
sleep 3

echo "Spawning Steve/Reed/Moss/Flint/Ember terminals..."
"$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-landfolk-agent.sh Steve 3001 prompts/landfolk/steve.md '$HOME/.hermes-landfolk-steve'; exec bash" &
sleep 1
"$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-landfolk-agent.sh Reed 3002 prompts/landfolk/reed.md '$HOME/.hermes-landfolk-reed'; exec bash" &
sleep 1
"$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-landfolk-agent.sh Moss 3003 prompts/landfolk/moss.md '$HOME/.hermes-landfolk-moss'; exec bash" &
sleep 1
"$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-landfolk-agent.sh Flint 3004 prompts/landfolk/flint.md '$HOME/.hermes-landfolk-flint'; exec bash" &
sleep 1
"$TERMINAL" -e bash -lc "cd '$SCRIPT_DIR' && ./scripts/run-landfolk-agent.sh Ember 3005 prompts/landfolk/ember.md '$HOME/.hermes-landfolk-ember'; exec bash" &

echo "Done. Terminals spawned for all 5 Landfolk agents."
