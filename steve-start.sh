#!/usr/bin/env bash
# Launch HermesCraft as Steve persona
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use Steve's SOUL
export HERMESCRAFT_SOUL="$SCRIPT_DIR/SOUL-steve.md"

# Launch with Steve's default goal
exec "$SCRIPT_DIR/hermescraft.sh" "${1:-Survive and thrive in this world. Build a home, gather resources, and explore.}"
