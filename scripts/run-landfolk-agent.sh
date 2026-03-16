#!/usr/bin/env bash
set -euo pipefail

NAME="${1:?Usage: run-landfolk-agent.sh NAME API_PORT PROMPT_FILE HOME_DIR}"
API_PORT="${2:?Usage: run-landfolk-agent.sh NAME API_PORT PROMPT_FILE HOME_DIR}"
PROMPT_FILE="${3:?Usage: run-landfolk-agent.sh NAME API_PORT PROMPT_FILE HOME_DIR}"
AGENT_HOME="${4:?Usage: run-landfolk-agent.sh NAME API_PORT PROMPT_FILE HOME_DIR}"
MODEL="${MODEL:-claude-sonnet-4-20250514}"
PROVIDER="${PROVIDER:-anthropic}"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# Do not override Anthropic auth here.
# Let Hermes resolve credentials naturally (e.g. ~/.claude/.credentials.json).
unset ANTHROPIC_API_KEY || true
unset ANTHROPIC_TOKEN || true
unset CLAUDE_CODE_OAUTH_TOKEN || true

export PATH="$SCRIPT_DIR/bin:$PATH"

until curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; do
  echo "[$NAME] waiting for bot body on port ${API_PORT}..."
  sleep 1
done

PROMPT="$(cat "$PROMPT_FILE")"

echo "[$NAME] starting Hermes on port ${API_PORT} using ${MODEL}/${PROVIDER}"
HERMES_HOME="$AGENT_HOME" MC_API_URL="http://localhost:${API_PORT}" MC_USERNAME="$NAME" hermes chat --yolo -q "$PROMPT" -m "$MODEL" --provider "$PROVIDER"
