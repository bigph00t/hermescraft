#!/bin/bash
# start-models.sh — Sequential dual-model startup for RunPod A6000 48GB
# Main brain: llama-server (heretic Q6_K GGUF) on port 8000
# Secondary brain: vLLM (Qwen3.5-9B) on port 8001
# Called by start-stack.sh — not meant to be run standalone during normal ops
set -e

MODEL_DIR="${MODEL_DIR:-/models}"
MAIN_MODEL="$MODEL_DIR/qwen35-27b-heretic-q6_k.gguf"
SECONDARY_MODEL="Qwen/Qwen3.5-9B"

# Set HuggingFace cache to network volume so vLLM finds pre-downloaded weights
export HF_HOME="${MODEL_DIR}/.cache"

if [ ! -f "$MAIN_MODEL" ]; then
    echo "[start-models] ERROR: Main model not found at $MAIN_MODEL"
    echo "[start-models] Run infra/setup-pod.sh first to download models"
    exit 1
fi

echo "[start-models] Starting main brain (llama-server) on port 8000..."
llama-server \
  -m "$MAIN_MODEL" \
  --port 8000 \
  --host 0.0.0.0 \
  --n-gpu-layers 999 \
  --flash-attn \
  --ctx-size 32768 \
  --chat-template qwen3 \
  --served-model-name hermes \
  -n 512 &
LLAMA_PID=$!

echo "[start-models] Waiting for llama-server health..."
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 5; done
echo "[start-models] llama-server ready on port 8000 (PID $LLAMA_PID)"

# Wait 30s for CUDA allocations to settle before starting second model
echo "[start-models] Waiting 30s for CUDA allocations to settle..."
sleep 30

echo "[start-models] Starting secondary brain (vLLM) on port 8001..."
vllm serve "$SECONDARY_MODEL" \
  --port 8001 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.38 \
  --max-model-len 32768 \
  --enforce-eager \
  --served-model-name secondary &
VLLM_PID=$!

echo "[start-models] Waiting for vLLM health..."
until curl -sf http://localhost:8001/health > /dev/null 2>&1; do sleep 5; done
echo "[start-models] vLLM ready on port 8001 (PID $VLLM_PID)"

echo "[start-models] Both models running."
nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv,noheader

wait $LLAMA_PID $VLLM_PID
