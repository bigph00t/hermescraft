#!/usr/bin/env bash
# Launch HermesCraft as Steve persona — open-ended survival mode
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Steve config
export AGENT_NAME="Steve"
export AGENT_MODE="open_ended"
export AGENT_SOUL="$SCRIPT_DIR/SOUL-steve.md"

# Launch via start.sh (direct mode) or hermescraft.sh (Hermes Agent mode)
if [ "${1:-}" = "--hermes" ]; then
    shift
    exec "$SCRIPT_DIR/hermescraft.sh" "${1:-Survive and thrive in this world.}"
else
    exec "$SCRIPT_DIR/start.sh"
fi
