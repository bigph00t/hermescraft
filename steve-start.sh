#!/usr/bin/env bash
# Launch Steve via the Hermes Agent CLI with Minecraft MCP tools
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Steve uses the actual Hermes CLI with his SOUL personality
export HERMESCRAFT_SOUL="$SCRIPT_DIR/SOUL-steve.md"

exec "$SCRIPT_DIR/hermescraft.sh" "${1:-Survive and thrive in this world. Build a home, gather resources, and explore.}"
