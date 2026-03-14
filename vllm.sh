#!/bin/bash
# Start vLLM server — run this first, leave it running forever
# Auto-restarts on crash. Run in its own terminal.

# Ensure conda python is on PATH (RunPod resets PATH on pod restart)
[ -d /workspace/miniconda/bin ] && export PATH=/workspace/miniconda/bin:$PATH

MODEL="${MODEL_NAME:-Doradus/Hermes-4.3-36B-FP8}"
PORT="${VLLM_PORT:-8000}"
GPU_MEM="${GPU_MEM:-0.95}"
MAX_LEN="${MAX_MODEL_LEN:-16384}"

echo "Starting vLLM — $MODEL"
echo "Port: $PORT | GPU mem: $GPU_MEM | Max len: $MAX_LEN"
echo ""

while true; do
  python3 -m vllm.entrypoints.openai.api_server \
    --model "$MODEL" \
    --host 0.0.0.0 \
    --port "$PORT" \
    --max-model-len "$MAX_LEN" \
    --gpu-memory-utilization "$GPU_MEM" \
    --enable-auto-tool-choice \
    --tool-call-parser hermes \
    --enable-prefix-caching \
    --max-num-seqs 1 \
    --trust-remote-code

  echo "[!] vLLM died — cleaning up GPU and restarting in 5s..."
  # Kill zombie EngineCore processes that hold GPU memory after crashes
  nvidia-smi --query-compute-apps=pid --format=csv,noheader 2>/dev/null | xargs -r kill -9 2>/dev/null
  sleep 5
done
