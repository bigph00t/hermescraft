#!/bin/bash
# start-models.sh — Single-model launch: Qwen3.5-35B-A3B MoE via llama-server
# Main brain: llama-server (Qwen3.5-35B-A3B Q4_K_XL GGUF + mmproj) on port 8000
# Called by start-stack.sh — not meant to be run standalone during normal ops
set -e

MODEL_DIR="${MODEL_DIR:-/models}"
MAIN_MODEL="$MODEL_DIR/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf"
MMPROJ="$MODEL_DIR/mmproj-F16.gguf"

# Set HuggingFace cache to network volume
export HF_HOME="${MODEL_DIR}/.cache"

if [ ! -f "$MAIN_MODEL" ]; then
    echo "[start-models] ERROR: Model not found at $MAIN_MODEL"
    echo "[start-models] Run infra/setup-pod.sh first to download models"
    exit 1
fi

if [ ! -f "$MMPROJ" ]; then
    echo "[start-models] WARNING: mmproj not found at $MMPROJ — vision will be disabled"
fi
MMPROJ_FLAG=""
[ -f "$MMPROJ" ] && MMPROJ_FLAG="--mmproj $MMPROJ"

echo "[start-models] Starting Qwen3.5-35B-A3B on port 8000..."
llama-server \
  -m "$MAIN_MODEL" \
  $MMPROJ_FLAG \
  --port 8000 \
  --host 0.0.0.0 \
  --n-gpu-layers 999 \
  --flash-attn \
  --ctx-size 32768 \
  --chat-template qwen3 \
  --served-model-name Qwen3.5-35B-A3B \
  -n 128 &
LLAMA_PID=$!

echo "[start-models] Waiting for llama-server health..."
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 5; done
echo "[start-models] Qwen3.5-35B-A3B ready on port 8000 (PID $LLAMA_PID)"

nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv,noheader

wait $LLAMA_PID
