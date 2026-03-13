#!/bin/bash
# Start HermesCraft agent — run AFTER:
#   1. vllm.sh is running and model is loaded
#   2. Minecraft client is open and in a world
#   3. OBS is set up (if streaming)

set -euo pipefail
cd "$(dirname "$0")"

# Load .env if present
[ -f .env ] && { set -a; source .env; set +a; }

VLLM_URL="${VLLM_URL:-http://localhost:8000/v1}"
MOD_URL="${MOD_URL:-http://localhost:3001}"
MODEL_NAME="${MODEL_NAME:-NousResearch/Hermes-4.3-Llama-3.3-36B-AWQ}"
TICK_MS="${TICK_MS:-3000}"

# npm install if needed
[ ! -d node_modules ] && npm install --production

# Check vLLM
echo -n "Checking vLLM... "
if ! curl -s "${VLLM_URL}/models" > /dev/null 2>&1; then
  echo "FAILED — vLLM not responding at ${VLLM_URL}"
  echo "Run ./vllm.sh in another terminal first."
  exit 1
fi
echo "OK"

# Check HermesBridge
echo -n "Checking HermesBridge... "
if ! curl -s "${MOD_URL}/health" > /dev/null 2>&1; then
  echo "FAILED — HermesBridge not responding at ${MOD_URL}"
  echo "Make sure Minecraft is running with the HermesBridge mod."
  exit 1
fi
echo "OK"

echo ""
echo "=== Starting Hermes ==="
echo ""

# Auto-restart loop
while true; do
  VLLM_URL="$VLLM_URL" \
  MOD_URL="$MOD_URL" \
  MODEL_NAME="$MODEL_NAME" \
  TICK_MS="$TICK_MS" \
    node agent/index.js

  CODE=$?
  [ $CODE -eq 0 ] && break
  echo "[!] Agent crashed (exit $CODE) — restarting in 3s..."
  sleep 3
done
