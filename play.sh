#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# play.sh — Quick launcher (alias for hermescraft.sh)
#
# Usage:
#   ./play.sh                          # interactive companion
#   ./play.sh "Build a house"          # with a goal
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/hermescraft.sh" "$@"
