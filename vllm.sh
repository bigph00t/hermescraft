#!/bin/bash
# Start vLLM server — run this first, leave it running forever
# Auto-restarts on crash. Run in its own terminal.

MODEL="${MODEL_NAME:-NousResearch/Hermes-4-14B}"
PORT="${VLLM_PORT:-8000}"
GPU_MEM="${GPU_MEM:-0.90}"
MAX_LEN="${MAX_MODEL_LEN:-8192}"

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
    --tool-call-parser hermes

  echo "[!] vLLM died — restarting in 5s..."
  sleep 5
done
